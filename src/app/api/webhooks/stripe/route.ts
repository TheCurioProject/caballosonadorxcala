export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { sendBookingConfirmation, sendInvoiceEmail, sendAdminBookingNotification } from '@/lib/resend';
import { differenceInDays } from 'date-fns';
import { generateInvoicePDFBuffer, generateTourInvoicePDFBuffer } from '@/lib/pdf';
import fs from 'fs';
import path from 'path';
import { confirmRedemption, releaseRedemption } from '@/lib/coupons.server';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new NextResponse('Missing stripe signature', { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Webhook] CRITICAL: STRIPE_WEBHOOK_SECRET is not configured');
    return new NextResponse('Webhook secret not configured', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    // Multi-room checkouts store "<session>#<booking>" on every extra room.
    await prisma.booking.updateMany({ where: { OR: [{ externalId: session.id }, { externalId: { startsWith: `${session.id}#` } }], payment_status: 'PENDING' }, data: { payment_status: 'EXPIRED' } });
    await prisma.serviceBooking.updateMany({ where: { externalId: session.id, paymentStatus: 'PENDING' }, data: { paymentStatus: 'EXPIRED' } });
    // The coupon use held by this checkout is free again.
    if (session.metadata?.couponCode) await releaseRedemption(session.id).catch(error => console.error('[Webhook] coupon release failed', error));
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (!['paid', 'no_payment_required'].includes(session.payment_status)) return NextResponse.json({ received: true });
    const bookingId = session.metadata?.bookingId;
    // Several rooms paid in one checkout: the first id is `bookingId`.
    const groupIds = (session.metadata?.groupBookingIds || '').split(',').map(Number).filter(id => Number.isSafeInteger(id) && id > 0);
    const isGroup = groupIds.length > 1 && groupIds[0] === Number(bookingId);
    const serviceBookingId = session.metadata?.serviceBookingId;
    const type = session.metadata?.type;
    const currency = (session.currency || 'mxn').toUpperCase();
    
    if (bookingId) {
      try {
        // IDEMPOTENCY: Check if already processed to prevent duplicate emails on Stripe retries
        const existingBooking = await prisma.booking.findUnique({
          where: { id: parseInt(bookingId) }
        });
        if (existingBooking?.payment_status === 'CONFIRMED') {
          if(process.env.DATA_BACKEND!=='supabase')return NextResponse.json({received:true});
          const receipts=await prisma.$queryRaw<Array<{session_id:string}>>`SELECT session_id FROM site.stripe_receipts WHERE booking_id=${existingBooking.id}::integer AND session_id=${session.id}::text`;
          if(receipts.length)return NextResponse.json({received:true});
        }

        if (!existingBooking || (existingBooking.externalId && existingBooking.externalId !== session.id)) {
          return NextResponse.json({ error: 'Booking/session mismatch' }, { status: 409 });
        }
        const amountTotal = session.amount_total != null ? session.amount_total / 100 : undefined;
        // Update booking status in database
        let booking;
        if(process.env.DATA_BACKEND==='supabase') {
          if(session.amount_total==null)return NextResponse.json({error:'Payment amount missing'}, {status:409});
          const accepted=isGroup
            ? await prisma.$queryRaw<Array<{accepted:boolean}>>`SELECT site.accept_stripe_group_payment(${groupIds}::integer[],${event.id}::text,${session.id}::text,${BigInt(session.amount_total)}::bigint,${currency}::text) AS accepted`
            : await prisma.$queryRaw<Array<{accepted:boolean}>>`SELECT site.accept_stripe_payment(${Number(bookingId)}::integer,${event.id}::text,${session.id}::text,${BigInt(session.amount_total)}::bigint,${currency}::text) AS accepted`;
          if(!accepted[0]?.accepted)return NextResponse.json({received:true,reviewRequired:true});
          booking=await prisma.booking.findUniqueOrThrow({where:{id:Number(bookingId)},include:{property:true,addons:true}});
        }else{
        booking = await prisma.booking.update({
          where: { id: parseInt(bookingId) },
          data: { 
            payment_status: 'PAID',
            externalId: session.id,
            depositPaid: amountTotal,
            depositCurrency: currency,
            ...(amountTotal !== undefined && !isGroup ? { totalPrice: amountTotal } : {})
          },
          include: { property: true, addons: true },
        });
        if (isGroup) await prisma.booking.updateMany({ where: { id: { in: groupIds.slice(1) } }, data: { payment_status: 'PAID', depositCurrency: currency } });
        }
        // A group is announced once, with the whole amount and every room.
        const groupRooms = isGroup ? await prisma.booking.findMany({ where: { id: { in: groupIds } }, orderBy: { id: 'asc' }, select: { id: true, notes: true } }) : [];
        const groupTotal = isGroup && amountTotal !== undefined ? amountTotal : booking.totalPrice;
        const roomName = isGroup
          ? groupRooms.map(r => /^Alojamiento: (.+?)\. Huéspedes/.exec(r.notes || '')?.[1]).filter(Boolean).join(' + ') || `${groupIds.length} habitaciones`
          : booking.property?.name || 'Casa Caballo Soñador';

        // The coupon use now counts, with the discount Stripe really applied.
        if (session.metadata?.couponCode) await confirmRedemption(session.id, session.total_details?.amount_discount ?? null).catch(error => console.error('[Webhook] coupon confirmation failed', error));

        console.log('[Webhook] Booking confirmed:', bookingId);

        const nights = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));

        // Send confirmation email to guest
        await ensureEmail(sendBookingConfirmation({
          idempotencyKey: `stripe-booking-${booking.id}`,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }),
          checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }),
          totalPrice: groupTotal,
          currency,
          bookingId: booking.id,
          nights,
        }));

        const rawAdminEmails = booking.property?.adminEmails || process.env.BOOKING_ADMIN_EMAIL || '';
        const adminEmailArray = rawAdminEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e);

        // Generate Invoice PDF Buffer
        let pdfBuffer: Buffer | undefined = undefined;
        try {
          const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_official.png');
          const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
          
          pdfBuffer = await generateInvoicePDFBuffer({
            issuedAt: booking.createdAt,
            bookingId: booking.id,
            guestName: booking.guestName,
            roomName,
            checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { timeZone: 'UTC' }),
            checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { timeZone: 'UTC' }),
            totalPrice: groupTotal,
            depositPaid: isGroup && amountTotal !== undefined ? amountTotal : booking.depositPaid || 0,
            depositCurrency: booking.depositCurrency || 'MXN',
            date: booking.createdAt.toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
            logoBase64: logoBase64,
            addons: booking.addons
          });
        } catch (pdfError) {
          console.error('[Webhook] Failed to generate invoice PDF for admin notification', pdfError);
          throw pdfError;
        }

        const emailData = {
          idempotencyKey: `stripe-${serviceBookingId ? 'service' : 'booking'}-${booking.id}`,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }),
          checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }),
          totalPrice: groupTotal,
          currency,
          bookingId: booking.id,
          nights,
        };

        // Send confirmation to admins
        if (adminEmailArray.length > 0) {
          await ensureEmail(sendAdminBookingNotification(adminEmailArray, emailData, pdfBuffer));
        }

        // Send invoice email to guest
        await ensureEmail(sendInvoiceEmail(emailData, pdfBuffer));
        await prisma.$transaction(async tx=>{
          await tx.booking.updateMany({where:{id:{in:isGroup?groupIds:[booking.id]}},data:{payment_status:'CONFIRMED'}});
          if(process.env.DATA_BACKEND==='supabase')await tx.$executeRaw`INSERT INTO site.stripe_receipts(session_id,booking_id) VALUES(${session.id}::text,${booking.id}::integer) ON CONFLICT(session_id) DO NOTHING`;
        });

      } catch (dbError) {
        console.error('[Webhook] Error updating booking:', dbError);
        return NextResponse.json({ error: 'Payment processing failed; retry required' }, { status: 500 });
      }
    } else if (serviceBookingId) {
      try {
        // IDEMPOTENCY: Check if already processed to prevent duplicate emails on Stripe retries
        const existingServiceBooking = await prisma.serviceBooking.findUnique({
          where: { id: parseInt(serviceBookingId) }
        });
        if (existingServiceBooking?.paymentStatus === 'CONFIRMED') {
          console.log('[Webhook] Tour Booking already confirmed (idempotent skip):', serviceBookingId);
          return NextResponse.json({ received: true });
        }

        if (!existingServiceBooking || (existingServiceBooking.externalId && existingServiceBooking.externalId !== session.id)) {
          return NextResponse.json({ error: 'Booking/session mismatch' }, { status: 409 });
        }
        const booking = await prisma.serviceBooking.update({
          where: { id: parseInt(serviceBookingId) },
          data: { paymentStatus: 'PAID', externalId: session.id, ...(session.amount_total != null ? { totalPrice: session.amount_total / 100 } : {}) }
        });

        console.log('[Webhook] Tour Booking confirmed:', serviceBookingId);

        let tourDetails = { destinations: [] as any[], items: [] as any[] };
        try {
          tourDetails = JSON.parse(booking.serviceDetails);
        } catch (e) {
          console.warn('Failed to parse serviceDetails in webhook', e);
        }
        const destinationNames = (type === 'food' ? tourDetails.items : tourDetails.destinations)?.map((d: any) => d.name).join(', ') || (type === 'food' ? 'Food service / Servicio de comida' : 'Tour');

        const { sendTourConfirmation, sendTourInvoiceEmail } = await import('@/lib/resend');

        // Fetch property admin emails
        const property = await prisma.property.findFirst();
        const rawAdminEmails = property?.adminEmails || process.env.BOOKING_ADMIN_EMAIL || '';
        const adminEmailArray = rawAdminEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e);

        // Send confirmation to guest
        await ensureEmail(sendTourConfirmation({
          idempotencyKey: `stripe-service-${booking.id}`,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          serviceType: booking.serviceType === 'FOOD' ? 'FOOD' as const : 'TOUR' as const,
          tourDestination: destinationNames,
          date: new Date(booking.startDate).toLocaleDateString('es-MX', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }),
          pax: booking.pax || 1,
          totalPrice: booking.totalPrice,
          currency,
          bookingId: booking.id
        }));

        // Generate Tour Invoice PDF Buffer
        let pdfBuffer: Buffer | undefined = undefined;
        try {
          const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_official.png');
          const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
          
          pdfBuffer = await generateTourInvoicePDFBuffer({
            issuedAt: booking.createdAt,
            bookingId: booking.id,
            guestName: booking.guestName,
            serviceType: booking.serviceType === 'FOOD' ? 'FOOD' as const : 'TOUR' as const,
            tourDestination: destinationNames,
            date: new Date(booking.startDate).toLocaleDateString('es-MX', { timeZone: 'UTC' }),
            pax: booking.pax || 1,
            totalPrice: booking.totalPrice,
            currency: currency,
            issueDate: booking.createdAt.toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
            logoBase64: logoBase64
          });
        } catch (pdfError) {
          console.error('[Webhook] Failed to generate tour invoice PDF for admin notification', pdfError);
          throw pdfError;
        }

        const emailData = {
          idempotencyKey: `stripe-${serviceBookingId ? 'service' : 'booking'}-${booking.id}`,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          serviceType: booking.serviceType === 'FOOD' ? 'FOOD' as const : 'TOUR' as const,
          tourDestination: destinationNames,
          date: new Date(booking.startDate).toLocaleDateString('es-MX', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }),
          pax: booking.pax || 1,
          totalPrice: booking.totalPrice,
          currency,
          bookingId: booking.id
        };

        // Send confirmation to admin
        if (adminEmailArray.length > 0) {
          await ensureEmail(sendAdminBookingNotification(adminEmailArray, emailData, pdfBuffer));
        }

        // Send Invoice email to guest
        await ensureEmail(sendTourInvoiceEmail(emailData, pdfBuffer));
        await prisma.serviceBooking.update({ where: { id: booking.id }, data: { paymentStatus: 'CONFIRMED' } });

      } catch (error) {
        console.error('[Webhook] Error updating tour booking:', error);
        return NextResponse.json({ error: 'Payment processing failed; retry required' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}

async function ensureEmail(result: Promise<{ success: boolean; error?: unknown }>) {
  const value = await result;
  if (!value.success) throw new Error('Email delivery failed', { cause: value.error });
}

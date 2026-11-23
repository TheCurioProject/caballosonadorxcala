import type Stripe from 'stripe';
import prisma from '@/lib/prisma';
import { sendBookingConfirmation, sendInvoiceEmail, sendAdminBookingNotification, sendAdminPaymentReviewNotification } from '@/lib/resend';
import { differenceInDays } from 'date-fns';
import { generateInvoicePDFBuffer, generateTourInvoicePDFBuffer } from '@/lib/pdf';
import fs from 'fs';
import path from 'path';
import { confirmRedemption, releaseRedemption } from '@/lib/coupons.server';

/**
 * Turning a Stripe checkout into records (site booking → CALA reservation,
 * payment, e-mails). Shared by the Stripe webhook and by the pending-checkout
 * cron, which reconciles any paid session whose webhook never arrived, so a
 * paid stay is always registered in CALA even when the webhook fails.
 */
export type FulfillmentResult = { status: number; body: Record<string, unknown> };

const ok = (body: Record<string, unknown> = { received: true }): FulfillmentResult => ({ status: 200, body });

/** Every website record that belongs to this checkout session (a group stores "<session>#<booking>" on its extra rooms). */
export function sessionBookingsWhere(sessionId: string) {
  return { OR: [{ externalId: sessionId }, { externalId: { startsWith: `${sessionId}#` } }] };
}

/** The checkout ended unpaid: its holds are released (CALA cancels the reservation, the calendar opens again). */
export async function expireSessionRecords(sessionId: string) {
  const bookings = await prisma.booking.updateMany({ where: { ...sessionBookingsWhere(sessionId), payment_status: 'PENDING' }, data: { payment_status: 'EXPIRED' } });
  const services = await prisma.serviceBooking.updateMany({ where: { externalId: sessionId, paymentStatus: 'PENDING' }, data: { paymentStatus: 'EXPIRED' } });
  // The coupon use held by this checkout is free again (no-op without a coupon).
  await releaseRedemption(sessionId).catch(error => console.error('[Stripe] coupon release failed', error));
  return bookings.count + services.count;
}

export async function fulfillPaidSession(session: Stripe.Checkout.Session, eventId: string): Promise<FulfillmentResult> {
  if (!['paid', 'no_payment_required'].includes(session.payment_status)) return ok();
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
        if(process.env.DATA_BACKEND!=='supabase')return ok();
        const receipts=await prisma.$queryRaw<Array<{session_id:string}>>`SELECT session_id FROM site.stripe_receipts WHERE booking_id=${existingBooking.id}::integer AND session_id=${session.id}::text`;
        if(receipts.length)return ok();
      }

      if (!existingBooking || (existingBooking.externalId && existingBooking.externalId !== session.id)) {
        return { status: 409, body: { error: 'Booking/session mismatch' } };
      }
      // Checkout could not store the session id (it is only written after Stripe answers);
      // the signed metadata identifies the booking, so the id is restored before accepting.
      if (!existingBooking.externalId) {
        await prisma.$transaction([
          prisma.booking.updateMany({ where: { id: existingBooking.id, externalId: null }, data: { externalId: session.id } }),
          ...(isGroup ? groupIds.slice(1).map(id => prisma.booking.updateMany({ where: { id, externalId: null }, data: { externalId: `${session.id}#${id}` } })) : []),
        ]);
      }
      const amountTotal = session.amount_total != null ? session.amount_total / 100 : undefined;
      // Update booking status in database
      let booking;
      if(process.env.DATA_BACKEND==='supabase') {
        if(session.amount_total==null)return { status: 409, body: {error:'Payment amount missing'} };
        const accepted=isGroup
          ? await prisma.$queryRaw<Array<{accepted:boolean}>>`SELECT site.accept_stripe_group_payment(${groupIds}::integer[],${eventId}::text,${session.id}::text,${BigInt(session.amount_total)}::bigint,${currency}::text) AS accepted`
          : await prisma.$queryRaw<Array<{accepted:boolean}>>`SELECT site.accept_stripe_payment(${Number(bookingId)}::integer,${eventId}::text,${session.id}::text,${BigInt(session.amount_total)}::bigint,${currency}::text) AS accepted`;
        if(!accepted[0]?.accepted){
          // Charged but not confirmable (dates taken): a person must act, so the admins are told now.
          await notifyPaymentReview(Number(bookingId), session).catch(error => console.error('[Stripe] payment review notice failed', error));
          return ok({received:true,reviewRequired:true});
        }
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
      const retreatRoom = /^Alojamiento: (.+?)\. Huéspedes/m.exec(booking.notes || '')?.[1];
      const roomName = isGroup
        ? groupRooms.map(r => /^Alojamiento: (.+?)\. Huéspedes/.exec(r.notes || '')?.[1]).filter(Boolean).join(' + ') || `${groupIds.length} habitaciones`
        : session.metadata?.retreatTitle
          ? `Retiro: ${session.metadata.retreatTitle}${retreatRoom ? ` · ${retreatRoom}` : ''}`
          : booking.property?.name || 'Casa Caballo Soñador';

      // The coupon use now counts, with the discount Stripe really applied.
      if (session.metadata?.couponCode) await confirmRedemption(session.id, session.total_details?.amount_discount ?? null).catch(error => console.error('[Stripe] coupon confirmation failed', error));

      console.log('[Stripe] Booking confirmed:', bookingId);

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
          logoBase64: logoBase64(),
          addons: booking.addons
        });
      } catch (pdfError) {
        console.error('[Stripe] Failed to generate invoice PDF for admin notification', pdfError);
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
      console.error('[Stripe] Error updating booking:', dbError);
      return { status: 500, body: { error: 'Payment processing failed; retry required' } };
    }
  } else if (serviceBookingId) {
    try {
      // IDEMPOTENCY: Check if already processed to prevent duplicate emails on Stripe retries
      const existingServiceBooking = await prisma.serviceBooking.findUnique({
        where: { id: parseInt(serviceBookingId) }
      });
      if (existingServiceBooking?.paymentStatus === 'CONFIRMED') {
        console.log('[Stripe] Tour Booking already confirmed (idempotent skip):', serviceBookingId);
        return ok();
      }

      if (!existingServiceBooking || (existingServiceBooking.externalId && existingServiceBooking.externalId !== session.id)) {
        return { status: 409, body: { error: 'Booking/session mismatch' } };
      }
      const booking = await prisma.serviceBooking.update({
        where: { id: parseInt(serviceBookingId) },
        data: { paymentStatus: 'PAID', externalId: session.id, ...(session.amount_total != null ? { totalPrice: session.amount_total / 100 } : {}) }
      });

      console.log('[Stripe] Tour Booking confirmed:', serviceBookingId);

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
          logoBase64: logoBase64()
        });
      } catch (pdfError) {
        console.error('[Stripe] Failed to generate tour invoice PDF for admin notification', pdfError);
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
      console.error('[Stripe] Error updating tour booking:', error);
      return { status: 500, body: { error: 'Payment processing failed; retry required' } };
    }
  }
  return ok();
}

async function notifyPaymentReview(bookingId: number, session: Stripe.Checkout.Session) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { property: true } });
  if (!booking) return;
  const admins = (booking.property?.adminEmails || process.env.BOOKING_ADMIN_EMAIL || '').split(',').map(e => e.trim()).filter(Boolean);
  const date = (d: Date) => new Date(d).toLocaleDateString('es-MX', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
  if (admins.length) await sendAdminPaymentReviewNotification(admins, {
    bookingId, guestName: booking.guestName, guestEmail: booking.guestEmail, guestPhone: booking.guestPhone,
    checkIn: date(booking.checkIn), checkOut: date(booking.checkOut),
    amount: (session.amount_total ?? 0) / 100, currency: (session.currency || 'mxn').toUpperCase(), sessionId: session.id,
    panelUrl: `${process.env.CALA_PUBLIC_ORIGIN || 'https://www.casacaballosonador.com'}/admin/finanzas/?tab=web`,
  });
  // The CALA bell gets it from the database (trigger on site.integration_alerts).
}

function logoBase64() {
  const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_official.png');
  return fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
}

async function ensureEmail(result: Promise<{ success: boolean; error?: unknown }>) {
  const value = await result;
  if (!value.success) throw new Error('Email delivery failed', { cause: value.error });
}

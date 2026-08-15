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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;
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
          console.log('[Webhook] Booking already confirmed (idempotent skip):', bookingId);
          return NextResponse.json({ received: true });
        }

        const amountTotal = session.amount_total ? session.amount_total / 100 : undefined;
        // Update booking status in database
        const booking = await prisma.booking.update({
          where: { id: parseInt(bookingId) },
          data: { 
            payment_status: 'CONFIRMED',
            ...(amountTotal !== undefined ? { totalPrice: amountTotal } : {})
          },
          include: { property: true, addons: true },
        });

        console.log('[Webhook] Booking confirmed:', bookingId);

        const nights = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));

        // Send confirmation email to guest
        await sendBookingConfirmation({
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
          checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
          totalPrice: booking.totalPrice,
          currency,
          bookingId: booking.id,
          nights,
        });

        const rawAdminEmails = booking.property?.adminEmails || 'kelli9@telus.net';
        const adminEmailArray = rawAdminEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e);

        // Generate Invoice PDF Buffer
        let pdfBuffer: Buffer | undefined = undefined;
        try {
          const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_official.png');
          const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
          
          pdfBuffer = await generateInvoicePDFBuffer({
            bookingId: booking.id,
            guestName: booking.guestName,
            roomName: booking.property?.name || 'Casa Caballo Soñador',
            checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
            checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
            totalPrice: booking.totalPrice,
            depositPaid: booking.depositPaid || 0,
            depositCurrency: booking.depositCurrency || 'MXN',
            date: new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
            logoBase64: logoBase64,
            addons: booking.addons
          });
        } catch (pdfError) {
          console.error('[Webhook] Failed to generate invoice PDF for admin notification', pdfError);
        }

        const emailData = {
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
          checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
          totalPrice: booking.totalPrice,
          currency,
          bookingId: booking.id,
          nights,
        };

        // Send confirmation to admins
        if (adminEmailArray.length > 0) {
          await sendAdminBookingNotification(adminEmailArray, emailData, pdfBuffer);
        }

        // Send invoice email to guest
        await sendInvoiceEmail(emailData, pdfBuffer);

      } catch (dbError) {
        console.error('[Webhook] Error updating booking:', dbError);
      }
    } else if (serviceBookingId && type === 'tour') {
      try {
        // IDEMPOTENCY: Check if already processed to prevent duplicate emails on Stripe retries
        const existingServiceBooking = await prisma.serviceBooking.findUnique({
          where: { id: parseInt(serviceBookingId) }
        });
        if (existingServiceBooking?.paymentStatus === 'CONFIRMED') {
          console.log('[Webhook] Tour Booking already confirmed (idempotent skip):', serviceBookingId);
          return NextResponse.json({ received: true });
        }

        const booking = await prisma.serviceBooking.update({
          where: { id: parseInt(serviceBookingId) },
          data: { paymentStatus: 'CONFIRMED' }
        });

        console.log('[Webhook] Tour Booking confirmed:', serviceBookingId);

        let tourDetails = { destinations: [] as any[] };
        try {
          tourDetails = JSON.parse(booking.serviceDetails);
        } catch (e) {
          console.warn('Failed to parse serviceDetails in webhook', e);
        }
        const destinationNames = tourDetails.destinations?.map((d: any) => d.name).join(', ') || 'Tour';

        const { sendTourConfirmation, sendTourInvoiceEmail } = await import('@/lib/resend');

        // Fetch property admin emails
        const property = await prisma.property.findFirst();
        const rawAdminEmails = property?.adminEmails || 'kelli9@telus.net';
        const adminEmailArray = rawAdminEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e);

        // Send confirmation to guest
        await sendTourConfirmation({
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          tourDestination: destinationNames,
          date: new Date(booking.startDate).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
          pax: booking.pax || 1,
          totalPrice: booking.totalPrice,
          currency,
          bookingId: booking.id
        });

        // Generate Tour Invoice PDF Buffer
        let pdfBuffer: Buffer | undefined = undefined;
        try {
          const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_official.png');
          const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
          
          pdfBuffer = await generateTourInvoicePDFBuffer({
            bookingId: booking.id,
            guestName: booking.guestName,
            tourDestination: destinationNames,
            date: new Date(booking.startDate).toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
            pax: booking.pax || 1,
            totalPrice: booking.totalPrice,
            currency: currency,
            issueDate: new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
            logoBase64: logoBase64
          });
        } catch (pdfError) {
          console.error('[Webhook] Failed to generate tour invoice PDF for admin notification', pdfError);
        }

        const emailData = {
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          tourDestination: destinationNames,
          date: new Date(booking.startDate).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
          pax: booking.pax || 1,
          totalPrice: booking.totalPrice,
          currency,
          bookingId: booking.id
        };

        // Send confirmation to admin
        if (adminEmailArray.length > 0) {
          await sendAdminBookingNotification(adminEmailArray, emailData, pdfBuffer);
        }

        // Send Invoice email to guest
        await sendTourInvoiceEmail(emailData, pdfBuffer);

      } catch (error) {
        console.error('[Webhook] Error updating tour booking:', error);
      }
    }
  }

  return NextResponse.json({ received: true });
}

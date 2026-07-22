export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/lib/prisma';
import { sendBookingConfirmation, sendInvoiceEmail } from '@/lib/resend';
import { differenceInDays } from 'date-fns';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_for_build', {
  apiVersion: '2025-02-24.acacia' as any,
});

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new NextResponse('Missing stripe signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
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
        // Update booking status in database
        const booking = await prisma.booking.update({
          where: { id: parseInt(bookingId) },
          data: { payment_status: 'CONFIRMED' },
          include: { property: true },
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

        // Send confirmation to admins
        if (adminEmailArray.length > 0) {
          await sendBookingConfirmation({
            guestName: booking.guestName,
            guestEmail: booking.guestEmail,
            toEmails: adminEmailArray,
            checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
            checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
            totalPrice: booking.totalPrice,
            currency,
            bookingId: booking.id,
            nights,
          });
        }

        // Send invoice email (without PDF attachment for now)
        await sendInvoiceEmail({
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
          checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
          totalPrice: booking.totalPrice,
          currency,
          bookingId: booking.id,
          nights,
        });

      } catch (dbError) {
        console.error('[Webhook] Error updating booking:', dbError);
      }
    } else if (serviceBookingId && type === 'tour') {
      try {
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

        // Send confirmation to admin
        if (adminEmailArray.length > 0) {
          await sendTourConfirmation({
            guestName: booking.guestName,
            guestEmail: booking.guestEmail,
            tourDestination: destinationNames,
            date: new Date(booking.startDate).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
            pax: booking.pax || 1,
            totalPrice: booking.totalPrice,
            currency,
            bookingId: booking.id,
            toEmails: adminEmailArray
          });
        }

        // Send Invoice email without pdf attachment initially
        await sendTourInvoiceEmail({
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          tourDestination: destinationNames,
          date: new Date(booking.startDate).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
          pax: booking.pax || 1,
          totalPrice: booking.totalPrice,
          currency,
          bookingId: booking.id
        });

      } catch (error) {
        console.error('[Webhook] Error updating tour booking:', error);
      }
    }
  }

  return NextResponse.json({ received: true });
}

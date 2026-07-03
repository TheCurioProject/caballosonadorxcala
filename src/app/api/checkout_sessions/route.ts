export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { checkIn, checkOut, guestName, guestEmail, totalPrice } = body;

    if (!checkIn || !checkOut || !guestName || !guestEmail || !totalPrice) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    // Usually you would verify availability here before creating the session to prevent double booking.
    // We assume the frontend already sent valid dates for now, and handle lock/release in a more robust system via Webhooks.

    // 1. Create a "PENDING" booking in the database
    // We assume propertyId = 1 since there is only one Property.
    let property = await prisma.property.findFirst();
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const booking = await prisma.booking.create({
      data: {
        propertyId: property.id,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        guestName,
        guestEmail,
        totalPrice,
        payment_status: 'PENDING',
        origin: 'WEBSITE',
      }
    });

    // 2. Create Stripe Checkout Session
    const origin = req.headers.get('origin') || 'http://localhost:3000';
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: 'Reserva - Casa del Caballo Soñador',
              description: `Fechas: ${new Date(checkIn).toLocaleDateString()} al ${new Date(checkOut).toLocaleDateString()}`,
            },
            unit_amount: Math.round(totalPrice * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking.id}`,
      cancel_url: `${origin}/?canceled=true`,
      customer_email: guestEmail,
      metadata: {
        bookingId: booking.id.toString(),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Error creating checkout session:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

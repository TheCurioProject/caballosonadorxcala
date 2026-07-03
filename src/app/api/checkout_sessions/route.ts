export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { checkIn, checkOut, guestName, guestEmail, guestPhone, totalPrice, currency = 'mxn' } = body;

    if (!checkIn || !checkOut || !guestName || !guestEmail || !guestPhone || !totalPrice) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    let booking;
    
    // 1. Create a "PENDING" booking in the database with explicit error handling for DB timeouts
    try {
      let property = await prisma.property.findFirst();
      if (!property) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }

      // Clean up expired pending bookings
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      await prisma.booking.deleteMany({
        where: {
          payment_status: 'PENDING',
          createdAt: { lt: fifteenMinutesAgo }
        }
      });

      // Check for overlapping bookings or blocks
      const overlappingBookings = await prisma.booking.findMany({
        where: {
          propertyId: property.id,
          payment_status: { in: ['CONFIRMED', 'PENDING'] },
          checkIn: { lt: new Date(checkOut) },
          checkOut: { gt: new Date(checkIn) }
        }
      });

      const overlappingBlocks = await prisma.blockedDate.findMany({
        where: {
          propertyId: property.id,
          startDate: { lt: new Date(checkOut) },
          endDate: { gt: new Date(checkIn) }
        }
      });

      if (overlappingBookings.length > 0 || overlappingBlocks.length > 0) {
        return NextResponse.json({ 
          error: 'Las fechas seleccionadas acaban de ser reservadas. Por favor, elige otras.' 
        }, { status: 409 });
      }

      booking = await prisma.booking.create({
        data: {
          propertyId: property.id,
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          guestName,
          guestEmail,
          guestPhone,
          totalPrice,
          payment_status: 'PENDING',
          origin: 'WEBSITE',
        }
      });
    } catch (dbError: any) {
      console.error('[Checkout DB Error]:', dbError);
      return NextResponse.json({ 
        error: 'Error al conectar con la base de datos. Por favor, inténtalo de nuevo en unos minutos.' 
      }, { status: 503 });
    }

    // 2. Create Stripe Checkout Session
    try {
      const origin = req.headers.get('origin') || 'http://localhost:3000';
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
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
    } catch (stripeError: any) {
      console.error('[Checkout Stripe Error]:', stripeError);
      // Delete the pending booking if Stripe fails
      try {
        await prisma.booking.delete({ where: { id: booking.id } });
      } catch (e) {
        console.error('Failed to cleanup booking after stripe error', e);
      }
      return NextResponse.json({ error: 'Error al inicializar el pago con Stripe.' }, { status: 502 });
    }
    
  } catch (err: any) {
    console.error('[Checkout General Error]:', err);
    return NextResponse.json({ error: 'Ocurrió un error inesperado.' }, { status: 500 });
  }
}

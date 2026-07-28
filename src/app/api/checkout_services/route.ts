export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      serviceType, 
      serviceDetails, 
      startDate, 
      endDate, 
      pax, 
      guestName, 
      guestEmail, 
      guestPhone, 
      totalPrice, 
      items = [], 
      currency = 'usd' 
    } = body;

    if (!serviceType || !startDate || !endDate || !guestName || !guestEmail || !totalPrice) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    let serviceBooking;
    
    // Clean up expired pending bookings
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    try {
      await Promise.all([
        prisma.booking.deleteMany({
          where: { payment_status: 'PENDING', createdAt: { lt: fifteenMinutesAgo } }
        }),
        prisma.serviceBooking.deleteMany({
          where: { paymentStatus: 'PENDING', createdAt: { lt: fifteenMinutesAgo } }
        })
      ]);
    } catch (cleanupError) {
      console.error('Error during cleanup in checkout services:', cleanupError);
    }

    // 1. Create a "PENDING" service booking in the database
    try {
      serviceBooking = await prisma.serviceBooking.create({
        data: {
          serviceType,
          serviceDetails: JSON.stringify(serviceDetails),
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          pax: pax ? parseInt(pax) : null,
          guestName,
          guestEmail,
          guestPhone,
          totalPrice,
          paymentStatus: 'PENDING'
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
        line_items: items.map((item: any) => ({
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: item.name,
              description: item.description || '',
            },
            unit_amount: Math.round(item.unitPrice * 100),
          },
          quantity: item.quantity || 1,
        })),
        mode: 'payment',
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&service_booking_id=${serviceBooking.id}`,
        cancel_url: `${origin}/?canceled=true`,
        customer_email: guestEmail,
        metadata: {
          serviceBookingId: serviceBooking.id.toString(),
          type: serviceType.toLowerCase()
        },
      });

      return NextResponse.json({ url: session.url });
    } catch (stripeError: any) {
      console.error('[Checkout Stripe Error]:', stripeError);
      // Delete the pending booking if Stripe fails
      try {
        await prisma.serviceBooking.delete({ where: { id: serviceBooking.id } });
      } catch (e) {
        console.error('Failed to cleanup service booking after stripe error', e);
      }
      return NextResponse.json({ error: 'Error al inicializar el pago con Stripe.' }, { status: 502 });
    }
    
  } catch (err: any) {
    console.error('[Checkout General Error]:', err);
    return NextResponse.json({ error: 'Ocurrió un error inesperado.' }, { status: 500 });
  }
}

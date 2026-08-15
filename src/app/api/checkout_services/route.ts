export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { getBilingualText } from '@/lib/bilingual';

// ─── Simple in-memory rate limiter ───
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export async function POST(req: Request) {
  try {
    // Rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip') 
      || 'unknown';
    if (isRateLimited(clientIp)) {
      return NextResponse.json({ error: 'Demasiados intentos. Por favor, espera un momento.' }, { status: 429 });
    }

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
      currency = 'usd',
      lang = 'es'
    } = body;

    if (!serviceType || !startDate || !endDate || !guestName || !guestEmail || !totalPrice) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    // Validate totalPrice is a positive number
    if (typeof totalPrice !== 'number' || totalPrice <= 0 || !isFinite(totalPrice)) {
      return NextResponse.json({ error: 'Precio total inválido' }, { status: 400 });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 });
    }

    // Validate each item has required fields and positive prices
    for (const item of items) {
      if (!item.name || typeof item.unitPrice !== 'number' || item.unitPrice < 0 || !isFinite(item.unitPrice)) {
        return NextResponse.json({ error: 'Datos de item inválidos' }, { status: 400 });
      }
      if (typeof item.quantity === 'number' && (item.quantity < 1 || !Number.isInteger(item.quantity))) {
        return NextResponse.json({ error: 'Cantidad de item inválida' }, { status: 400 });
      }
    }

    let serviceBooking;
    
    // 1. Create a "PENDING" service booking in the database
    try {
      // VULN-13: Clean up expired pending service bookings
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      await prisma.serviceBooking.deleteMany({
        where: {
          paymentStatus: 'PENDING',
          createdAt: { lt: fifteenMinutesAgo }
        }
      });

      serviceBooking = await prisma.serviceBooking.create({
        data: {
          serviceType,
          serviceDetails: JSON.stringify(serviceDetails),
          startDate: start,
          endDate: end,
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
        allow_promotion_codes: true,
        payment_method_types: ['card'],
        line_items: items.map((item: any) => ({
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: getBilingualText(item.name),
              description: getBilingualText(item.description) || '',
            },
            unit_amount: Math.round(item.unitPrice * 100),
          },
          quantity: item.quantity || 1,
        })),
        mode: 'payment',
        success_url: `${origin}/${lang}/checkout/success?session_id={CHECKOUT_SESSION_ID}&service_booking_id=${serviceBooking.id}`,
        cancel_url: `${origin}/${lang}?canceled=true`,
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

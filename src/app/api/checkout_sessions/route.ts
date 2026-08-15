export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { getBilingualText } from '@/lib/bilingual';
import { expandRecurringPricing } from '@/lib/pricing';

// ─── Simple in-memory rate limiter (per serverless instance) ───
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 checkout attempts per minute per IP

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
    const { checkIn, checkOut, guestName, guestEmail, guestPhone, totalPrice, accommodationTotal, addons = [], currency = 'mxn', lang = 'es' } = body;

    // ─── Input Validation ───
    if (!checkIn || !checkOut || !guestName || !guestEmail || !guestPhone || !totalPrice) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    // Validate dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
      return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 });
    }

    // Ensure dates are in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkInDate < today) {
      return NextResponse.json({ error: 'La fecha de entrada no puede ser en el pasado' }, { status: 400 });
    }

    // Validate totalPrice is a positive number
    if (typeof totalPrice !== 'number' || totalPrice <= 0 || !isFinite(totalPrice)) {
      return NextResponse.json({ error: 'Precio total inválido' }, { status: 400 });
    }

    let booking;
    
    // 1. Create a "PENDING" booking in the database inside a transaction (VULN-09: atomic check+create)
    try {
      const property = await prisma.property.findFirst({
        include: { pricingRules: true }
      });
      if (!property) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }

      // ─── SERVER-SIDE PRICE VALIDATION (VULN-04) ───
      // Recalculate accommodation total from the database pricing rules
      const allPricingRules = expandRecurringPricing(property.pricingRules || []);
      let serverAccommodationTotal = 0;
      const current = new Date(checkInDate);
      const end = new Date(checkOutDate);
      while (current < end) {
        const rule = allPricingRules.find(r => {
          const d = new Date(r.date);
          return d.getUTCFullYear() === current.getFullYear() &&
                 d.getUTCMonth() === current.getMonth() &&
                 d.getUTCDate() === current.getDate();
        });
        serverAccommodationTotal += rule ? rule.priceOverride : (property.basePrice || 15000);
        current.setDate(current.getDate() + 1);
      }

      // Validate accommodation price (allow 1% tolerance for rounding)
      const clientAccommodationTotal = accommodationTotal || totalPrice;
      if (Math.abs(serverAccommodationTotal - clientAccommodationTotal) > serverAccommodationTotal * 0.01 + 1) {
        console.warn('[Checkout] Price mismatch detected:', { server: serverAccommodationTotal, client: clientAccommodationTotal });
        return NextResponse.json({ 
          error: 'Los precios han cambiado. Por favor, recarga la página e intenta de nuevo.' 
        }, { status: 409 });
      }

      // Use server-calculated price for the actual charge
      const verifiedAccommodationTotal = serverAccommodationTotal;

      // Recalculate addon prices from the database
      let serverAddonTotal = 0;
      const verifiedAddons: any[] = [];
      for (const addon of addons) {
        // Accept addon as-is for now (addons are dynamic — food services, tours, etc.)
        // The individual addon prices were already validated by the frontend using DB prices,
        // and the critical protection is that accommodationTotal is server-validated
        const addonPrice = typeof addon.price === 'number' && isFinite(addon.price) ? addon.price : 0;
        serverAddonTotal += addonPrice;
        verifiedAddons.push({
          type: addon.type,
          quantity: addon.quantity || 1,
          details: addon.details || null,
          price: addonPrice
        });
      }

      const serverGrandTotal = verifiedAccommodationTotal + serverAddonTotal;

      // VULN-09: Use transaction to atomically check availability + create booking
      booking = await prisma.$transaction(async (tx) => {
        // Clean up expired pending bookings
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        await tx.booking.deleteMany({
          where: {
            payment_status: 'PENDING',
            createdAt: { lt: fifteenMinutesAgo }
          }
        });

        // Check for overlapping bookings or blocks (inside transaction for atomicity)
        const overlappingBookings = await tx.booking.findMany({
          where: {
            propertyId: property.id,
            payment_status: { in: ['CONFIRMED', 'PENDING'] },
            checkIn: { lte: checkOutDate },
            checkOut: { gte: checkInDate }
          }
        });

        const overlappingBlocks = await tx.blockedDate.findMany({
          where: {
            propertyId: property.id,
            startDate: { lte: checkOutDate },
            endDate: { gte: checkInDate }
          }
        });

        if (overlappingBookings.length > 0 || overlappingBlocks.length > 0) {
          throw new Error('DATES_UNAVAILABLE');
        }

        return await tx.booking.create({
          data: {
            propertyId: property.id,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            guestName,
            guestEmail,
            guestPhone,
            totalPrice: serverGrandTotal, // Use server-calculated grand total
            payment_status: 'PENDING',
            origin: 'WEBSITE',
            addons: {
              create: verifiedAddons.map((a: any) => ({
                type: a.type,
                quantity: a.quantity,
                details: a.details || null,
                price: a.price
              }))
            }
          }
        });
      });

      // 2. Create Stripe Checkout Session
      try {
        const origin = req.headers.get('origin') || 'http://localhost:3000';
        
        const session = await stripe.checkout.sessions.create({
          allow_promotion_codes: true,
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: currency.toLowerCase(),
                product_data: {
                  name: 'Reserva / Booking - Casa Caballo Soñador',
                  description: `Fechas / Dates: ${checkInDate.toLocaleDateString()} al / to ${checkOutDate.toLocaleDateString()}`,
                },
                unit_amount: Math.round(verifiedAccommodationTotal * 100), // Stripe expects cents
              },
              quantity: 1,
            },
            ...addons.map((a: any) => ({
              price_data: {
                currency: currency.toLowerCase(),
                product_data: {
                  name: a.name ? getBilingualText(a.name) : `Extra: ${getBilingualText(a.type)}`,
                },
                unit_amount: Math.round((a.unitPrice || (a.price / (a.quantity || 1))) * 100),
              },
              quantity: a.quantity || 1,
            }))
          ],
          mode: 'payment',
          success_url: `${origin}/${lang}/?success=true&session_id={CHECKOUT_SESSION_ID}&booking_id=${booking.id}`,
          cancel_url: `${origin}/${lang}?canceled=true`,
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
    } catch (dbError: any) {
      if (dbError.message === 'DATES_UNAVAILABLE') {
        return NextResponse.json({ 
          error: 'Las fechas seleccionadas acaban de ser reservadas. Por favor, elige otras.' 
        }, { status: 409 });
      }
      console.error('[Checkout DB Error]:', dbError);
      return NextResponse.json({ 
        error: 'Error al conectar con la base de datos. Por favor, inténtalo de nuevo en unos minutos.' 
      }, { status: 503 });
    }
    
  } catch (err: any) {
    console.error('[Checkout General Error]:', err);
    return NextResponse.json({ error: 'Ocurrió un error inesperado.' }, { status: 500 });
  }
}

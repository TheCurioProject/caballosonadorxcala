import {calaConfiguration} from '@/lib/cala/config';
import { Prisma } from '@prisma/client';
import { CHECKOUT_SECONDS, activeBookingWhere, hotelToday, parseCalendarDate, validGuest, verifyAddon, validateAddonDates } from '@/lib/bookingPolicy';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { getBilingualText } from '@/lib/bilingual';
import { expandRecurringPricing } from '@/lib/pricing';
import { lodgingSelectionSchema, type LodgingSelection, lodgingText } from '@/lib/lodgings';
import { getLodgings, quoteLodging } from '@/lib/lodgings.server';

// ─── Simple in-memory rate limiter (per serverless instance) ───
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 checkout attempts per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 10000) {
    for (const [key, value] of rateLimitMap) if (value.resetAt <= now) rateLimitMap.delete(key);
    if (rateLimitMap.size > 10000) return true;
  }
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
    if (!validGuest(guestName, guestEmail, guestPhone) || !guestPhone || !Array.isArray(addons) || addons.length > 100 ||
        currency !== 'mxn' || !['es', 'en'].includes(lang)) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const checkInDate = parseCalendarDate(checkIn);
    const checkOutDate = parseCalendarDate(checkOut);
    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate || checkIn < hotelToday() ||
        checkOutDate.getTime() - checkInDate.getTime() > 366 * 86400000) {
      return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 });
    }

    // Validate totalPrice is a positive number
    if (typeof totalPrice !== 'number' || totalPrice <= 0 || !isFinite(totalPrice)) {
      return NextResponse.json({ error: 'Precio total inválido' }, { status: 400 });
    }

    if(!calaConfiguration().ready)return NextResponse.json({error:"Las reservas están en preparación. Contacta al alojamiento."},{status:503});
    const catalog = await getLodgings();
    let selection: LodgingSelection | null = null;
    const selectedLodging = catalog.find(l => l.id === body.lodgingId);
    if (catalog.length || body.lodgingId !== undefined) {
      const parsed = lodgingSelectionSchema.safeParse({lodgingId: body.lodgingId, adults: body.adults, children: body.children});
      if (!parsed.success || !selectedLodging) return NextResponse.json({error: 'Selecciona un alojamiento y un número válido de huéspedes.'}, {status: 400});
      selection = parsed.data;
    }
    if (!process.env.STRIPE_SECRET_KEY?.trim()) return NextResponse.json({error: 'Los pagos están en preparación. Contacta al alojamiento para confirmar tu estancia.'}, {status: 503});
    let booking;
    
    // 1. Create a "PENDING" booking in the database inside a transaction (VULN-09: atomic check+create)
    try {
      const property = await prisma.property.findFirst({
        where: { isActive: true },
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
          return d.getUTCFullYear() === current.getUTCFullYear() &&
                 d.getUTCMonth() === current.getUTCMonth() &&
                 d.getUTCDate() === current.getUTCDate();
        });
        serverAccommodationTotal += rule ? rule.priceOverride : (property.basePrice || 15000);
        current.setUTCDate(current.getUTCDate() + 1);
      }

      if (selection) {
        serverAccommodationTotal = (await quoteLodging(selection, checkInDate, checkOutDate)) / 100;
      } else if(process.env.DATA_BACKEND==='supabase') {
        const quoted=await prisma.$queryRaw<Array<{total:bigint}>>`SELECT site.cala_quote(${property.id}::integer,${checkInDate}::date,${checkOutDate}::date) AS total`;
        if(!quoted[0])throw new Error('CALA_MAPPING_MISSING');
        serverAccommodationTotal=Number(quoted[0].total)/100;
      }
      // Validate accommodation price (allow 1% tolerance for rounding)
      const clientAccommodationTotal = accommodationTotal ?? totalPrice;
      if (typeof clientAccommodationTotal !== 'number' || !Number.isFinite(clientAccommodationTotal)) {
        return NextResponse.json({ error: 'Precio inválido' }, { status: 400 });
      }
      if (Math.abs(serverAccommodationTotal - clientAccommodationTotal) > serverAccommodationTotal * 0.01 + 1) {
        console.warn('[Checkout] Price mismatch detected:', { server: serverAccommodationTotal, client: clientAccommodationTotal });
        return NextResponse.json({ 
          error: 'Los precios han cambiado. Por favor, recarga la página e intenta de nuevo.' 
        }, { status: 409 });
      }

      // Use server-calculated price for the actual charge
      const verifiedAccommodationTotal = serverAccommodationTotal;

      const [food, tours] = await Promise.all([
        prisma.servicePricing.findMany({ where: { isActive: true } }),
        prisma.tourDestination.findMany({ where: { isActive: true } }),
      ]);
      let verifiedAddons;
      try {
        verifiedAddons = addons.map(addon => verifyAddon(addon, food, tours.map(tour => ({ ...tour, price: tour.pricePerPax }))));
        if(selection)validateAddonDates(verifiedAddons,checkIn,checkOut);
      } catch {
        return NextResponse.json({ error: 'Servicios adicionales inválidos' }, { status: 400 });
      }
      if (verifiedAddons.some(addon => addon.type.startsWith('TOUR_') && (addon.quantity < property.minTourPax || addon.quantity > property.maxTourPax))) {
        return NextResponse.json({ error: 'Número de pasajeros inválido' }, { status: 400 });
      }
      const serverAddonTotal = verifiedAddons.reduce((sum, addon) => sum + addon.price, 0);

      const serverGrandTotal = verifiedAccommodationTotal + serverAddonTotal;
      if (Math.abs(serverGrandTotal - totalPrice) > 0.01) {
        return NextResponse.json({ error: 'Los precios han cambiado. Recarga la página.' }, { status: 409 });
      }

      // VULN-09: Use transaction to atomically check availability + create booking
      booking = await prisma.$transaction(async (tx) => {
        if(process.env.DATA_BACKEND==='supabase')await tx.$queryRaw`SELECT site.lock_property(${property.id}::integer)`;
        // Serialize all availability checks for this property, including concurrent checkouts.
        if(process.env.DATA_BACKEND==='supabase') await tx.$queryRaw`SELECT id FROM site.properties WHERE id = ${property.id} FOR UPDATE`;
        else await tx.$queryRaw`SELECT id FROM properties WHERE id = ${property.id} FOR UPDATE`;

        if (selection) {
          if ((await quoteLodging(selection, checkInDate, checkOutDate, tx)) / 100 !== verifiedAccommodationTotal) throw new Error('PRICE_CHANGED');
        } else if(process.env.DATA_BACKEND==='supabase') {
          const quoted=await tx.$queryRaw<Array<{total:bigint}>>`SELECT site.cala_quote(${property.id}::integer,${checkInDate}::date,${checkOutDate}::date) AS total`;
          if(Number(quoted[0]?.total)/100!==verifiedAccommodationTotal)throw new Error('PRICE_CHANGED');
        }
        // Check for overlapping bookings or blocks (inside transaction for atomicity)
        const overlappingBookings = selection ? [] : await tx.booking.findMany({
          where: {
            propertyId: property.id,
            ...activeBookingWhere(),
            checkIn: { lte: checkOutDate },
            checkOut: { gte: checkInDate }
          }
        });

        const overlappingBlocks = selection ? [] : await tx.blockedDate.findMany({
          where: {
            propertyId: property.id,
            startDate: { lte: checkOutDate },
            endDate: { gte: checkInDate }
          }
        });

        if (overlappingBookings.length > 0 || overlappingBlocks.length > 0) {
          throw new Error('DATES_UNAVAILABLE');
        }

        const created = await tx.booking.create({
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
            ...(selectedLodging ? {notes: `Alojamiento: ${lodgingText(selectedLodging.name, lang)}. Huéspedes: ${selection!.adults} adultos, ${selection!.children} menores.`} : {}),
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
        if (selection) await tx.$executeRaw`INSERT INTO site.booking_lodging(booking_id,lodging_id,adults,children) VALUES(${created.id}::integer,${selection.lodgingId}::uuid,${selection.adults}::integer,${selection.children}::integer)`;
        return created;
      }, { isolationLevel: process.env.DATA_BACKEND==='supabase' ? Prisma.TransactionIsolationLevel.ReadCommitted : Prisma.TransactionIsolationLevel.Serializable });

      // 2. Create Stripe Checkout Session
      try {
        const origin = new URL(req.url).origin;
        
        const session = await stripe.checkout.sessions.create({
          allow_promotion_codes: true,
          expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SECONDS,
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: currency.toLowerCase(),
                product_data: {
                  name: selectedLodging ? `${lodgingText(selectedLodging.name, lang)} · Casa Caballo Soñador` : 'Reserva / Booking - Casa Caballo Soñador',
                  description: `Fechas / Dates: ${checkInDate.toLocaleDateString('es-MX', { timeZone: 'UTC' })} al / to ${checkOutDate.toLocaleDateString('es-MX', { timeZone: 'UTC' })}`,
                },
                unit_amount: Math.round(verifiedAccommodationTotal * 100), // Stripe expects cents
              },
              quantity: 1,
            },
            ...verifiedAddons.filter(a => a.unitPrice > 0).map((a) => ({
              price_data: {
                currency: currency.toLowerCase(),
                product_data: {
                  name: a.name ? getBilingualText(a.name) : `Extra: ${getBilingualText(a.type)}`,
                },
                unit_amount: Math.round(a.unitPrice * 100),
              },
              quantity: a.quantity || 1,
            }))
          ],
          mode: 'payment',
          success_url: `${origin}/${lang}/checkout/success/?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking.id}`,
          cancel_url: `${origin}/${lang}?canceled=true`,
          customer_email: guestEmail,
          metadata: {
            bookingId: booking.id.toString(),
            ...(selection ? {lodgingId: selection.lodgingId} : {}),
          },
        });

        try {
          await prisma.booking.update({ where: { id: booking.id }, data: { externalId: session.id } });
        } catch (error) {
          console.error('[Checkout] Could not persist session identifier; webhook metadata will reconcile it', error);
        }
        return NextResponse.json({ url: session.url });
      } catch (stripeError: any) {
        console.error('[Checkout Stripe Error]:', stripeError);
        // Retain failed checkout details for the administrator.
        try {
          await prisma.booking.updateMany({ where: { id: booking.id, payment_status: 'PENDING' }, data: { payment_status: 'FAILED' } });
        } catch (e) {
          console.error('Failed to cleanup booking after stripe error', e);
        }
        return NextResponse.json({ error: 'Error al inicializar el pago con Stripe.' }, { status: 502 });
      }
    } catch (dbError: any) {
      if (/DATES_UNAVAILABLE|UNIT_CONFLICT|NO_AVAILABILITY|LODGING_RULES|LODGING_SALES_CLOSED|RATE_RESTRICTION|PRICE_CHANGED|DEPARTURE_CLOSED/.test(String(dbError.meta?.message || dbError.message))) {
        return NextResponse.json({ 
          error: 'La estancia ya no está disponible con esas fechas, reglas o precio. Revisa tu selección.'
        }, { status: 409 });
      }
      console.error('[Checkout DB Error]', /^P\d{4}$/.test(dbError.code || '') ? dbError.code : 'DATABASE_OPERATION_FAILED');
      return NextResponse.json({ 
        error: 'Error al conectar con la base de datos. Por favor, inténtalo de nuevo en unos minutos.' 
      }, { status: 503 });
    }
    
  } catch (err: any) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    console.error('[Checkout General Error]:', err);
    return NextResponse.json({ error: 'Ocurrió un error inesperado.' }, { status: 500 });
  }
}

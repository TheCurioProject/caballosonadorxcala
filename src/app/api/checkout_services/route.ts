import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { stripe } from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { getBilingualText } from '@/lib/bilingual';
import { CHECKOUT_SECONDS, activeServiceWhere, hotelToday, parseCalendarDate, validGuest } from '@/lib/bookingPolicy';

export const dynamic = 'force-dynamic';
const attempts = new Map<string, { count: number; until: number }>();

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    if (attempts.size > 10000) for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const attempt = attempts.get(ip);
    if (attempt && attempt.until > now) {
      if (++attempt.count > 5) return NextResponse.json({ error: 'Demasiados intentos. Espera un momento.' }, { status: 429 });
    } else {
      if (attempts.size > 10000) return NextResponse.json({ error: 'Intenta más tarde' }, { status: 429 });
      attempts.set(ip, { count: 1, until: now + 60000 });
    }

    const { serviceType, startDate, endDate, pax, guestName, guestEmail, guestPhone, totalPrice, items, currency = 'mxn', lang = 'es' } = await req.json();
    const start = parseCalendarDate(typeof startDate === 'string' ? startDate.split('T')[0] : startDate);
    const end = parseCalendarDate(typeof endDate === 'string' ? endDate.split('T')[0] : endDate);
    if (!['FOOD', 'TOUR'].includes(serviceType) || !validGuest(guestName, guestEmail, guestPhone) ||
        !start || !end || end < start || start.toISOString().slice(0, 10) < hotelToday() || end.getTime() - start.getTime() > 366 * 86400000 ||
        !Array.isArray(items) || items.length === 0 || items.length > 100 || currency !== 'mxn' || !['es', 'en'].includes(lang) ||
        typeof totalPrice !== 'number' || !Number.isFinite(totalPrice) || totalPrice <= 0 ||
        (pax != null && (!Number.isInteger(Number(pax)) || Number(pax) < 1))) {
      return NextResponse.json({ error: 'Datos de reserva inválidos' }, { status: 400 });
    }

    const property = await prisma.property.findFirst({ where: { isActive: true } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    if (serviceType === 'TOUR' && (!pax || Number(pax) < property.minTourPax || Number(pax) > property.maxTourPax)) {
      return NextResponse.json({ error: 'Número de pasajeros inválido' }, { status: 400 });
    }

    const catalog = serviceType === 'TOUR'
      ? (await prisma.tourDestination.findMany({ where: { isActive: true } })).map(item => ({ ...item, price: item.pricePerPax }))
      : await prisma.servicePricing.findMany({ where: { isActive: true, serviceType: { in: ['FOOD', 'FOOD_SERVICE', 'FOOD_PRICE', 'FOOD_DISH'] } } });
    const verified: { id: number; name: string; unitPrice: number; quantity: number }[] = [];
    for (const item of items) {
      if (!item || typeof item !== 'object' || typeof item.name !== 'string') return NextResponse.json({ error: 'Servicio inválido' }, { status: 400 });
      const match = catalog.find(entry => item.id != null ? entry.id === Number(item.id) :
        entry.name === item.name || getBilingualText(entry.name) === getBilingualText(item.name));
      const quantity = item.quantity ?? 1;
      if (!match || !Number.isInteger(quantity) || quantity < 1 || quantity > 366 || !Number.isFinite(match.price) || match.price < 0 ||
          (serviceType === 'TOUR' && quantity !== Number(pax))) {
        return NextResponse.json({ error: 'Servicio o cantidad inválidos' }, { status: 400 });
      }
      verified.push({ id: match.id, name: match.name, unitPrice: Math.round(match.price * 100) / 100, quantity });
    }
    const serverTotal = verified.reduce((sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity, 0) / 100;
    if (serverTotal <= 0 || Math.abs(serverTotal - totalPrice) > 0.01) {
      return NextResponse.json({ error: 'Los precios han cambiado. Recarga la página.' }, { status: 409 });
    }

    const booking = await prisma.$transaction(async tx => {
      if(process.env.DATA_BACKEND==='supabase') await tx.$queryRaw`SELECT id FROM site.properties WHERE id = ${property.id} FOR UPDATE`;
        else await tx.$queryRaw`SELECT id FROM properties WHERE id = ${property.id} FOR UPDATE`;
      const block = await tx.serviceBlockedDate.findFirst({ where: { serviceType, startDate: { lte: end }, endDate: { gte: start } } });
      const otherTour = serviceType === 'TOUR' && await tx.serviceBooking.findFirst({ where: {
        serviceType, ...activeServiceWhere(), startDate: { lte: end }, endDate: { gte: start },
      } });
      if (block || otherTour) throw new Error('DATES_UNAVAILABLE');
      return tx.serviceBooking.create({ data: {
        serviceType, serviceDetails: JSON.stringify(serviceType === 'TOUR' ? { destinations: verified } : { items: verified }),
        startDate: start, endDate: end, pax: pax != null ? Number(pax) : null,
        guestName: guestName.trim(), guestEmail: guestEmail.trim(), guestPhone,
        totalPrice: serverTotal, paymentStatus: 'PENDING', invoiceLanguage: lang,
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    let checkout;
    try {
      const origin = new URL(req.url).origin;
      checkout = await stripe.checkout.sessions.create({
        allow_promotion_codes: true,
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SECONDS,
        payment_method_types: ['card'],
        line_items: verified.filter(item => item.unitPrice > 0).map(item => ({
          price_data: { currency: 'mxn', product_data: { name: getBilingualText(item.name) }, unit_amount: Math.round(item.unitPrice * 100) },
          quantity: item.quantity,
        })),
        mode: 'payment',
        success_url: `${origin}/${lang}/checkout/success/?session_id={CHECKOUT_SESSION_ID}&service_booking_id=${booking.id}`,
        cancel_url: `${origin}/${lang}/?canceled=true`, customer_email: guestEmail,
        metadata: { serviceBookingId: String(booking.id), type: serviceType.toLowerCase() },
      });
    } catch (error) {
      await prisma.serviceBooking.updateMany({ where: { id: booking.id, paymentStatus: 'PENDING' }, data: { paymentStatus: 'FAILED' } });
      console.error('[Services] Stripe checkout failed', error);
      return NextResponse.json({ error: 'No se pudo iniciar el pago.' }, { status: 502 });
    }
    await prisma.serviceBooking.update({ where: { id: booking.id }, data: { externalId: checkout.id } });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    if (error instanceof Error && error.message === 'DATES_UNAVAILABLE') return NextResponse.json({ error: 'Fechas no disponibles' }, { status: 409 });
    console.error('[Services] Checkout failed', error);
    return NextResponse.json({ error: 'No se pudo procesar la reserva.' }, { status: 503 });
  }
}

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { calaConfiguration } from '@/lib/cala/config';
import { CHECKOUT_SECONDS } from '@/lib/bookingPolicy';
import { getLodgings } from '@/lib/lodgings.server';
import { lodgingDisplayName } from '@/lib/lodgings';
import { heldTotalMinor, holdRetreat, listRetreats, retreatErrorCode, retreatsReady } from '@/lib/retreats.server';
import { RETREAT_MAX_GUESTS, retreatDates, retreatError, retreatNights, retreatText } from '@/lib/retreats';

export const dynamic = 'force-dynamic';

const attempts = new Map<string, { count: number; resetAt: number }>();
function limited(ip: string) {
  const now = Date.now();
  if (attempts.size > 10000) for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key);
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 60000 });
    return false;
  }
  return ++entry.count > 5;
}

const input = z.object({
  retreatId: z.number().int().positive(),
  lodgingId: z.uuid(),
  guests: z.number().int().min(1).max(RETREAT_MAX_GUESTS),
  guestName: z.string().trim().min(2).max(255),
  guestEmail: z.string().trim().max(255).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  guestPhone: z.string().trim().min(6).max(50),
  /** The total the guest saw (retreat + room at CALA's rates); a changed price is never charged silently. */
  priceMinor: z.number().int().positive(),
  lang: z.enum(['es', 'en']).default('es'),
});

class PriceChanged extends Error {}

/**
 * Retreat checkout: the charge is the retreat's price plus the chosen room at
 * CALA's rates for the retreat's nights (both computed by site.retreat_hold).
 */
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  if (limited(ip)) return NextResponse.json({ error: 'Demasiados intentos. Por favor, espera un momento.' }, { status: 429 });
  let lang = 'es';
  try {
    const parsed = input.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    const body = parsed.data;
    lang = body.lang;
    if (!calaConfiguration().ready || !(await retreatsReady()))
      return NextResponse.json({ error: lang === 'en' ? 'Retreat bookings are being prepared. Please contact us.' : 'Las reservas de retiros están en preparación. Contacta al alojamiento.' }, { status: 503 });
    if (!process.env.STRIPE_SECRET_KEY?.trim())
      return NextResponse.json({ error: lang === 'en' ? 'Payments are being prepared. Please contact us.' : 'Los pagos están en preparación. Contacta al alojamiento.' }, { status: 503 });

    const [retreats, catalog] = await Promise.all([listRetreats({ activeOnly: true }), getLodgings()]);
    const retreat = retreats.find(r => r.id === body.retreatId);
    const lodging = catalog.find(l => l.id === body.lodgingId);
    if (!retreat || !lodging || !retreat.priceMinor) return NextResponse.json({ error: retreatError('RETREAT_CLOSED', lang) }, { status: 409 });
    const retreatMinor = retreat.priceMinor;

    // Serialized with every other sale of the house (advisory lock in retreat_hold).
    // The hold prices the room at CALA's rates; a total different from the one
    // the guest saw rolls everything back.
    const held = await prisma.$transaction(
      async tx => {
        const id = await holdRetreat(tx, {
          retreatId: retreat.id, lodgingId: lodging.id, guests: body.guests,
          name: body.guestName, email: body.guestEmail, phone: body.guestPhone, lang,
        });
        const totalMinor = await heldTotalMinor(tx, id);
        if (totalMinor !== body.priceMinor) throw new PriceChanged();
        return { id, totalMinor };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    ).catch(error => {
      if (error instanceof PriceChanged) return null;
      throw error;
    });
    if (!held) return NextResponse.json({ error: retreatError('RETREAT_PRICE_CHANGED', lang), code: 'RETREAT_PRICE_CHANGED' }, { status: 409 });
    const bookingId = held.id;
    const lodgingMinor = Math.max(0, held.totalMinor - retreatMinor);

    try {
      const origin = new URL(req.url).origin;
      const title = retreatText(retreat.title, lang);
      const session = await stripe.checkout.sessions.create({
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SECONDS,
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: body.guestEmail,
        line_items: [
          {
            price_data: {
              currency: 'mxn',
              product_data: {
                name: `${lang === 'en' ? 'Retreat' : 'Retiro'}: ${title}`.slice(0, 250),
                description: `${retreatDates(retreat.startsOn, retreat.endsOn, lang)} · ${body.guests} ${lang === 'en' ? (body.guests === 1 ? 'guest' : 'guests') : (body.guests === 1 ? 'persona' : 'personas')}`.slice(0, 500),
              },
              unit_amount: held.totalMinor - lodgingMinor,
            },
            quantity: 1,
          },
          ...(lodgingMinor > 0 ? [{
            price_data: {
              currency: 'mxn',
              product_data: {
                name: `${lang === 'en' ? 'Lodging' : 'Hospedaje'}: ${lodgingDisplayName(lodging, lang)}`.slice(0, 250),
                description: `${retreatDates(retreat.startsOn, retreat.endsOn, lang)} · ${retreatNights(retreat.startsOn, retreat.endsOn)} ${lang === 'en' ? 'nights' : 'noches'}`.slice(0, 500),
              },
              unit_amount: lodgingMinor,
            },
            quantity: 1,
          }] : []),
        ],
        success_url: `${origin}/${lang}/checkout/success/?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
        cancel_url: `${origin}/${lang}/retiros/?canceled=true`,
        metadata: { bookingId: String(bookingId), lodgingId: lodging.id, retreatId: String(retreat.id), retreatTitle: retreat.title.es.slice(0, 200) },
      });
      await prisma.booking.update({ where: { id: bookingId }, data: { externalId: session.id } });
      return NextResponse.json({ url: session.url });
    } catch (stripeError) {
      console.error('[Retreat checkout] Stripe', stripeError);
      // FAILED gives the room back to the retreat (database trigger).
      await prisma.booking.updateMany({ where: { id: bookingId, payment_status: 'PENDING' }, data: { payment_status: 'FAILED' } }).catch(() => undefined);
      return NextResponse.json({ error: lang === 'en' ? 'Could not start the payment. Please try again.' : 'Error al inicializar el pago con Stripe.' }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    const code = retreatErrorCode(error);
    if (code) return NextResponse.json({ error: retreatError(code, lang), code }, { status: 409 });
    if (/UNIT_CONFLICT|NO_AVAILABILITY|SITE_INVENTORY/.test(String((error as { meta?: { message?: string }; message?: string })?.meta?.message ?? (error as Error)?.message)))
      return NextResponse.json({ error: retreatError('RETREAT_ROOM_TAKEN', lang), code: 'RETREAT_ROOM_TAKEN' }, { status: 409 });
    console.error('[Retreat checkout]', error);
    return NextResponse.json({ error: retreatError('', lang) }, { status: 503 });
  }
}

import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { HOLD_MILLISECONDS } from '@/lib/bookingPolicy';
import { expireSessionRecords, fulfillPaidSession } from '@/lib/stripeFulfillment.server';

/**
 * A website checkout holds its dates (PENDING → CALA "pending" reservation)
 * only from the moment the guest presses "Pay" until Stripe's 30-minute
 * session ends. Filling in the form never holds anything.
 *
 * - The guest leaves Stripe with its "back" link → `releaseCheckout` closes the
 *   Stripe session and frees the dates at once (they can retry right away).
 * - The cron (`reconcilePendingCheckouts`) never expires a hold blindly: it asks
 *   Stripe first. A paid session is registered (webhook missed or late), an open
 *   one is left alone, only an expired/unpaid one is released.
 */

type HoldKind = 'b' | 's'; // site booking (stay / retreat) | service booking (tour / food)

function holdKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || process.env.CRON_SECRET?.trim() || '';
}

function signature(kind: HoldKind, id: number) {
  return createHmac('sha256', holdKey()).update(`checkout-cancel:${kind}:${id}`).digest('hex').slice(0, 32);
}

/** Proves that whoever returns from Stripe owns this checkout (booking ids are guessable). */
export function holdToken(kind: HoldKind, id: number) {
  return holdKey() ? `${kind}${id}.${signature(kind, id)}` : '';
}

export function parseHoldToken(token: string | null): { kind: HoldKind; id: number } | null {
  const match = /^([bs])(\d{1,10})\.([0-9a-f]{32})$/.exec(token || '');
  if (!match || !holdKey()) return null;
  const kind = match[1] as HoldKind;
  const id = Number(match[2]);
  const expected = Buffer.from(signature(kind, id));
  const given = Buffer.from(match[3]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? { kind, id } : null;
}

/** Stripe's "back" link: the URL that frees the hold and returns the guest to the site. */
export function checkoutCancelUrl(origin: string, kind: HoldKind, id: number, returnPath: string) {
  const token = holdToken(kind, id);
  if (!token) return `${origin}${returnPath}?canceled=true`;
  return `${origin}/api/checkout/cancel/?t=${encodeURIComponent(token)}&to=${encodeURIComponent(returnPath)}`;
}

/** The guest abandoned Stripe: close the session (so it can no longer be paid) and free the dates now. */
export async function releaseCheckout(kind: HoldKind, id: number): Promise<'released' | 'paid' | 'unchanged'> {
  const record = kind === 'b'
    ? await prisma.booking.findUnique({ where: { id }, select: { payment_status: true, externalId: true } }).then(r => r && { status: r.payment_status, externalId: r.externalId })
    : await prisma.serviceBooking.findUnique({ where: { id }, select: { paymentStatus: true, externalId: true } }).then(r => r && { status: r.paymentStatus, externalId: r.externalId });
  const sessionId = record?.externalId?.split('#')[0];
  if (!record || record.status !== 'PENDING' || !sessionId) return 'unchanged';
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.status === 'complete') return 'paid';
  // Throws if the guest paid in the meantime — the hold is then kept.
  if (session.status === 'open') await stripe.checkout.sessions.expire(sessionId);
  await expireSessionRecords(sessionId);
  return 'released';
}

const BATCH = 25;
/** After this long without an answer from Stripe the hold is released anyway (a late payment is still accepted by the webhook). */
const GIVE_UP_MS = 24 * 60 * 60 * 1000;

function stripeNotFound(error: unknown) {
  const e = error as { code?: string; statusCode?: number };
  return e?.code === 'resource_missing' || e?.statusCode === 404;
}

/** Cron: settle every website hold older than the Stripe session window, checking Stripe first. */
export async function reconcilePendingCheckouts(now = new Date()) {
  const cutoff = new Date(now.getTime() - HOLD_MILLISECONDS);
  const [bookings, services] = await Promise.all([
    prisma.booking.findMany({ where: { payment_status: 'PENDING', origin: 'WEBSITE', createdAt: { lt: cutoff } }, select: { id: true, externalId: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 100 }),
    prisma.serviceBooking.findMany({ where: { paymentStatus: 'PENDING', externalId: { not: null }, createdAt: { lt: cutoff } }, select: { id: true, externalId: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 100 }),
  ]);
  const result = { expired: 0, registered: 0, stillOpen: 0, waiting: 0, errors: 0 };

  // A checkout without a session id never reached Stripe's payment page.
  const orphans = bookings.filter(b => !b.externalId).map(b => b.id);
  if (orphans.length) result.expired += (await prisma.booking.updateMany({ where: { id: { in: orphans }, payment_status: 'PENDING', externalId: null }, data: { payment_status: 'EXPIRED' } })).count;

  // One Stripe session per checkout (a multi-room group shares it).
  const sessions = new Map<string, Date>();
  for (const r of [...bookings, ...services]) {
    const id = r.externalId?.split('#')[0];
    if (id && !sessions.has(id)) sessions.set(id, r.createdAt);
  }

  for (const [sessionId, createdAt] of [...sessions].slice(0, BATCH)) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === 'complete') {
        if (['paid', 'no_payment_required'].includes(session.payment_status)) {
          // Paid but the webhook did not register it (yet): register it now.
          const done = await fulfillPaidSession(session, `reconcile:${session.id}`);
          if (done.status === 200) result.registered++;
          else { result.errors++; console.error('[Cron] Paid session could not be registered', sessionId, done.body); }
        } else result.waiting++; // payment still processing at Stripe
        continue;
      }
      if (session.status === 'open') {
        // Only possible if Stripe's own expiry is late; close it so it can no longer be paid.
        try { await stripe.checkout.sessions.expire(sessionId); }
        catch { result.stillOpen++; continue; }
      }
      result.expired += await expireSessionRecords(sessionId);
    } catch (error) {
      if (stripeNotFound(error) || now.getTime() - createdAt.getTime() > GIVE_UP_MS) {
        result.expired += await expireSessionRecords(sessionId).catch(() => 0);
      } else {
        result.errors++;
        console.error('[Cron] Stripe check failed; the hold is kept until the next run', sessionId, error);
      }
    }
  }
  return result;
}

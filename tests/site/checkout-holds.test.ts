import { beforeEach, expect, test, vi } from 'vitest';

// The cron must never release a paid or still-payable checkout, and a guest
// returning from Stripe must get their dates back at once.
const db = vi.hoisted(() => ({
  bookings: [] as Array<{ id: number; payment_status: string; origin: string; externalId: string | null; createdAt: Date }>,
  services: [] as Array<{ id: number; paymentStatus: string; externalId: string | null; createdAt: Date }>,
}));
const sessions = vi.hoisted(() => new Map<string, { id: string; status: string; payment_status: string }>());
const calls = vi.hoisted(() => ({ fulfilled: [] as string[], expiredAtStripe: [] as string[] }));

vi.mock('@/lib/prisma', () => {
  const match = (row: Record<string, any>, where: Record<string, any>): boolean => Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return (cond as any[]).some(c => match(row, c));
    const value = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('lt' in cond) return value < cond.lt;
      if ('in' in cond) return cond.in.includes(value);
      if ('not' in cond) return value !== cond.not;
      if ('startsWith' in cond) return typeof value === 'string' && value.startsWith(cond.startsWith);
    }
    return value === cond;
  });
  const table = (rows: () => any[]) => ({
    findMany: async ({ where }: any) => rows().filter(r => match(r, where)),
    findUnique: async ({ where }: any) => rows().find(r => r.id === where.id) ?? null,
    updateMany: async ({ where, data }: any) => {
      const hit = rows().filter(r => match(r, where));
      hit.forEach(r => Object.assign(r, data));
      return { count: hit.length };
    },
  });
  return { default: { booking: table(() => db.bookings), serviceBooking: table(() => db.services), $executeRaw: async () => 0 } };
});
vi.mock('@/lib/stripe', () => ({
  stripe: { checkout: { sessions: {
    retrieve: async (id: string) => {
      const s = sessions.get(id);
      if (!s) throw Object.assign(new Error('No such session'), { code: 'resource_missing', statusCode: 404 });
      return s;
    },
    expire: async (id: string) => { calls.expiredAtStripe.push(id); sessions.get(id)!.status = 'expired'; },
  } } },
}));
vi.mock('@/lib/stripeFulfillment.server', async () => {
  const prisma = (await import('@/lib/prisma')).default as any;
  return {
    fulfillPaidSession: async (session: { id: string }) => {
      calls.fulfilled.push(session.id);
      await prisma.booking.updateMany({ where: { OR: [{ externalId: session.id }, { externalId: { startsWith: `${session.id}#` } }] }, data: { payment_status: 'CONFIRMED' } });
      return { status: 200, body: { received: true } };
    },
    expireSessionRecords: async (sessionId: string) => (await prisma.booking.updateMany({
      where: { OR: [{ externalId: sessionId }, { externalId: { startsWith: `${sessionId}#` } }], payment_status: 'PENDING' }, data: { payment_status: 'EXPIRED' },
    })).count,
  };
});

const { reconcilePendingCheckouts, releaseCheckout, holdToken, parseHoldToken, checkoutCancelUrl } = await import('@/lib/checkoutHolds.server');

const now = new Date('2027-01-01T12:00:00Z');
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000);
const booking = (id: number, externalId: string | null, minutes: number) =>
  ({ id, payment_status: 'PENDING', origin: 'WEBSITE', externalId, createdAt: ago(minutes) });

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_holds';
  db.bookings = []; db.services = []; sessions.clear(); calls.fulfilled = []; calls.expiredAtStripe = [];
});

test('a guest still filling in the form or paying inside the window is never touched', async () => {
  db.bookings = [booking(1, 'cs_recent', 20), booking(2, 'cs_window', 34)];
  sessions.set('cs_recent', { id: 'cs_recent', status: 'open', payment_status: 'unpaid' });
  sessions.set('cs_window', { id: 'cs_window', status: 'open', payment_status: 'unpaid' });
  await reconcilePendingCheckouts(now);
  expect(db.bookings.map(b => b.payment_status)).toEqual(['PENDING', 'PENDING']);
  expect(calls.expiredAtStripe).toEqual([]);
});

test('a paid checkout whose webhook never arrived is registered instead of expired', async () => {
  db.bookings = [booking(1, 'cs_paid', 50), booking(2, 'cs_paid#2', 50)];
  sessions.set('cs_paid', { id: 'cs_paid', status: 'complete', payment_status: 'paid' });
  const result = await reconcilePendingCheckouts(now);
  expect(result.registered).toBe(1);
  expect(calls.fulfilled).toEqual(['cs_paid']);
  expect(db.bookings.map(b => b.payment_status)).toEqual(['CONFIRMED', 'CONFIRMED']);
});

test('only expired or abandoned checkouts are released, a whole group at once', async () => {
  db.bookings = [booking(1, 'cs_gone', 40), booking(2, 'cs_gone#2', 40), booking(3, 'cs_late_open', 40), booking(4, null, 40), booking(5, 'cs_missing', 40)];
  sessions.set('cs_gone', { id: 'cs_gone', status: 'expired', payment_status: 'unpaid' });
  sessions.set('cs_late_open', { id: 'cs_late_open', status: 'open', payment_status: 'unpaid' });
  await reconcilePendingCheckouts(now);
  expect(db.bookings.map(b => b.payment_status)).toEqual(['EXPIRED', 'EXPIRED', 'EXPIRED', 'EXPIRED', 'EXPIRED']);
  // An open session is closed at Stripe before its dates are freed, so it can no longer be paid.
  expect(calls.expiredAtStripe).toEqual(['cs_late_open']);
});

test('confirmed and CALA-made reservations are outside the cron', async () => {
  db.bookings = [{ ...booking(1, 'cs_x', 500), payment_status: 'CONFIRMED' }, { ...booking(2, null, 500), origin: 'CALA' }];
  await reconcilePendingCheckouts(now);
  expect(db.bookings.map(b => b.payment_status)).toEqual(['CONFIRMED', 'PENDING']);
});

test('returning from Stripe frees the dates at once, but never after a payment', async () => {
  db.bookings = [booking(1, 'cs_back', 2), booking(2, 'cs_done', 2)];
  sessions.set('cs_back', { id: 'cs_back', status: 'open', payment_status: 'unpaid' });
  sessions.set('cs_done', { id: 'cs_done', status: 'complete', payment_status: 'paid' });
  expect(await releaseCheckout('b', 1)).toBe('released');
  expect(await releaseCheckout('b', 2)).toBe('paid');
  expect(db.bookings.map(b => b.payment_status)).toEqual(['EXPIRED', 'PENDING']);
  expect(calls.expiredAtStripe).toEqual(['cs_back']);
});

test('the cancel link cannot be forged for someone else\'s booking', () => {
  const token = holdToken('b', 41);
  expect(parseHoldToken(token)).toEqual({ kind: 'b', id: 41 });
  expect(parseHoldToken(token.replace('b41', 'b42'))).toBeNull();
  expect(parseHoldToken('b41.' + '0'.repeat(32))).toBeNull();
  expect(checkoutCancelUrl('https://x.test', 'b', 41, '/es/')).toMatch(/^https:\/\/x\.test\/api\/checkout\/cancel\/\?t=b41\.[0-9a-f]{32}&to=%2Fes%2F$/);
});

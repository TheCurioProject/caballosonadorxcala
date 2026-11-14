import prisma from '@/lib/prisma';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { HOLD_MILLISECONDS, hotelToday } from '@/lib/bookingPolicy';
import { discountFor, type CouponRule } from '@/lib/coupons';

/** A website coupon as managed in CALA → Cupones. */
export interface SiteCoupon extends CouponRule {
  id: number;
  code: string;
  description: string | null;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  isActive: boolean;
  stripeCouponId: string | null;
  createdAt: string;
  /** Paid checkouts that used it. */
  used: number;
  /** Checkouts still open at Stripe (they hold a use until they expire). */
  pending: number;
  /** Total discount granted so far, in cents. */
  discountedMinor: number;
}

type Row = {
  id: number; code: string; description: string | null; discount_type: 'percent' | 'fixed'; value: unknown; min_total: unknown;
  valid_from: string | null; valid_until: string | null; max_redemptions: number | null; is_active: boolean; stripe_coupon_id: string | null;
  created_at: Date; used: bigint | number; pending: bigint | number; discounted: bigint | number | null;
};
const toCoupon = (r: Row): SiteCoupon => ({
  id: r.id, code: r.code, description: r.description, type: r.discount_type, value: Number(r.value), minTotal: Number(r.min_total),
  validFrom: r.valid_from, validUntil: r.valid_until, maxRedemptions: r.max_redemptions, isActive: r.is_active, stripeCouponId: r.stripe_coupon_id,
  createdAt: new Date(r.created_at).toISOString(), used: Number(r.used), pending: Number(r.pending), discountedMinor: Number(r.discounted ?? 0),
});

/** Coupons arrive with migration 20261119000000_site_coupons.sql. */
export async function couponsReady() {
  if (process.env.DATA_BACKEND !== 'supabase') return false;
  try {
    const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>`SELECT to_regclass('site.coupons') IS NOT NULL AS ok`;
    return Boolean(rows[0]?.ok);
  } catch {
    return false;
  }
}

/** A pending checkout holds its use for as long as Stripe keeps the session open. */
const holdStart = () => new Date(Date.now() - HOLD_MILLISECONDS);

async function selectCoupons(where: { id?: number; code?: string } = {}, database: Pick<typeof prisma, '$queryRaw'> = prisma) {
  const since = holdStart();
  const rows = await database.$queryRaw<Row[]>`
    SELECT c.id, c.code, c.description, c.discount_type, c.value, c.min_total,
           to_char(c.valid_from, 'YYYY-MM-DD') AS valid_from, to_char(c.valid_until, 'YYYY-MM-DD') AS valid_until,
           c.max_redemptions, c.is_active, c.stripe_coupon_id, c.created_at,
           (SELECT count(*) FROM site.coupon_redemptions r WHERE r.coupon_id = c.id AND r.status = 'paid') AS used,
           (SELECT count(*) FROM site.coupon_redemptions r WHERE r.coupon_id = c.id AND r.status = 'pending' AND r.created_at > ${since}) AS pending,
           (SELECT coalesce(sum(r.discount_minor), 0) FROM site.coupon_redemptions r WHERE r.coupon_id = c.id AND r.status = 'paid') AS discounted
    FROM site.coupons c
    WHERE (${where.id ?? null}::integer IS NULL OR c.id = ${where.id ?? null}::integer)
      AND (${where.code ?? null}::text IS NULL OR c.code = ${where.code ?? null}::text)
    ORDER BY c.is_active DESC, c.created_at DESC`;
  return rows.map(toCoupon);
}
export const listCoupons = () => selectCoupons();

export const normalizeCode = (raw: unknown) => String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '');

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
export const couponInput = z.object({
  id: z.number().int().positive().optional(),
  code: z.string().transform(normalizeCode).pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/)),
  description: z.string().trim().max(300).nullable().optional(),
  type: z.enum(['percent', 'fixed']),
  value: z.number().positive().max(1_000_000),
  minTotal: z.number().min(0).max(10_000_000).default(0),
  validFrom: date.optional(),
  validUntil: date.optional(),
  maxRedemptions: z.number().int().positive().max(1_000_000).nullable().optional(),
  isActive: z.boolean(),
}).refine(c => c.type !== 'percent' || c.value <= 100, { path: ['value'] })
  .refine(c => !c.validFrom || !c.validUntil || c.validUntil >= c.validFrom, { path: ['validUntil'] });
export type CouponInput = z.infer<typeof couponInput>;

export class CouponError extends Error {
  constructor(public reason: 'DUPLICATE_CODE' | 'NOT_FOUND' | 'INVALID' | 'INACTIVE' | 'NOT_STARTED' | 'EXPIRED' | 'EXHAUSTED' | 'MIN_TOTAL' | 'TOO_SMALL', public detail?: number) {
    super(reason);
  }
}

/** Creates or updates a coupon. A changed discount gets a new Stripe coupon (Stripe's are immutable). */
export async function saveCoupon(input: CouponInput): Promise<SiteCoupon> {
  const description = input.description?.trim() || null;
  try {
    if (input.id) {
      const before = (await selectCoupons({ id: input.id }))[0];
      if (!before) throw new CouponError('NOT_FOUND');
      const sameDiscount = before.type === input.type && before.value === input.value && before.code === input.code;
      await prisma.$executeRaw`
        UPDATE site.coupons SET code=${input.code}, description=${description}, discount_type=${input.type}, value=${input.value}::numeric,
          min_total=${input.minTotal}::numeric, valid_from=${input.validFrom ?? null}::date, valid_until=${input.validUntil ?? null}::date,
          max_redemptions=${input.maxRedemptions ?? null}::integer, is_active=${input.isActive},
          stripe_coupon_id=${sameDiscount ? before.stripeCouponId : null}, updated_at=now()
        WHERE id=${input.id}`;
      if (!sameDiscount && before.stripeCouponId) await stripe.coupons.del(before.stripeCouponId).catch(() => undefined);
      return (await selectCoupons({ id: input.id }))[0];
    }
    const created = await prisma.$queryRaw<Array<{ id: number }>>`
      INSERT INTO site.coupons(code, description, discount_type, value, min_total, valid_from, valid_until, max_redemptions, is_active)
      VALUES(${input.code}, ${description}, ${input.type}, ${input.value}::numeric, ${input.minTotal}::numeric, ${input.validFrom ?? null}::date,
        ${input.validUntil ?? null}::date, ${input.maxRedemptions ?? null}::integer, ${input.isActive})
      RETURNING id`;
    return (await selectCoupons({ id: created[0].id }))[0];
  } catch (error) {
    if (/23505|coupons_code_key|unique/i.test(String((error as { meta?: { code?: string } })?.meta?.code ?? '') + String((error as Error)?.message ?? ''))) throw new CouponError('DUPLICATE_CODE');
    throw error;
  }
}

export async function deleteCoupon(id: number) {
  const coupon = (await selectCoupons({ id }))[0];
  if (!coupon) return;
  await prisma.$executeRaw`DELETE FROM site.coupons WHERE id=${id}`;
  if (coupon.stripeCouponId) await stripe.coupons.del(coupon.stripeCouponId).catch(() => undefined);
}

/**
 * The coupon behind a code if the guest may use it now for an order of
 * `totalMinor` cents; otherwise throws CouponError with the reason.
 */
export async function usableCoupon(rawCode: unknown, totalMinor: number, database: Pick<typeof prisma, '$queryRaw'> = prisma) {
  const code = normalizeCode(rawCode);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) throw new CouponError('INVALID');
  const coupon = (await selectCoupons({ code }, database))[0];
  if (!coupon) throw new CouponError('INVALID');
  if (!coupon.isActive) throw new CouponError('INACTIVE');
  const today = hotelToday();
  if (coupon.validFrom && today < coupon.validFrom) throw new CouponError('NOT_STARTED');
  if (coupon.validUntil && today > coupon.validUntil) throw new CouponError('EXPIRED');
  if (coupon.maxRedemptions != null && coupon.used + coupon.pending >= coupon.maxRedemptions) throw new CouponError('EXHAUSTED');
  if (totalMinor < Math.round(coupon.minTotal * 100)) throw new CouponError('MIN_TOTAL', coupon.minTotal);
  const discountMinor = discountFor(coupon, totalMinor);
  const payable = totalMinor - discountMinor;
  // Stripe cannot charge less than $10 MXN (a fully discounted stay is fine).
  if (discountMinor <= 0 || (payable > 0 && payable < 1000)) throw new CouponError('TOO_SMALL');
  return { coupon, discountMinor };
}

/** The Stripe coupon that mirrors a CALA coupon, created on first use or when Stripe no longer has it. */
export async function stripeCouponFor(coupon: SiteCoupon): Promise<string> {
  if (coupon.stripeCouponId) {
    try {
      const existing = await stripe.coupons.retrieve(coupon.stripeCouponId);
      if (existing.valid) return existing.id;
    } catch { /* deleted in Stripe or created in another mode (test/live) */ }
  }
  const created = await stripe.coupons.create({
    name: coupon.code.slice(0, 40),
    duration: 'once',
    ...(coupon.type === 'percent' ? { percent_off: coupon.value } : { amount_off: Math.round(coupon.value * 100), currency: 'mxn' }),
    metadata: { source: 'cala', couponId: String(coupon.id), code: coupon.code },
  });
  await prisma.$executeRaw`UPDATE site.coupons SET stripe_coupon_id=${created.id} WHERE id=${coupon.id}`;
  return created.id;
}

// A checkout holds one use while it is open: /api/checkout_sessions inserts the
// `pending` row inside the booking transaction.

/** Payment confirmed by Stripe: the use counts, with the discount Stripe really applied. */
export async function confirmRedemption(sessionId: string, discountMinor: number | null) {
  await prisma.$executeRaw`
    UPDATE site.coupon_redemptions SET status='paid', paid_at=coalesce(paid_at, now()), discount_minor=coalesce(${discountMinor}::bigint, discount_minor)
    WHERE session_id=${sessionId} AND status<>'paid'`;
}

/** The checkout expired unpaid: the use is released. */
export async function releaseRedemption(sessionId: string) {
  await prisma.$executeRaw`UPDATE site.coupon_redemptions SET status='expired' WHERE session_id=${sessionId} AND status='pending'`;
}

import { NextResponse } from 'next/server';
import { CouponError, couponsReady, usableCoupon } from '@/lib/coupons.server';
import { couponMessage } from '@/lib/coupons';

export const dynamic = 'force-dynamic';

// Per-instance limiter: codes must not be guessable by brute force.
const attempts = new Map<string, { count: number; resetAt: number }>();
function limited(ip: string) {
  const now = Date.now();
  if (attempts.size > 5000) for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key);
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  return ++entry.count > 8;
}

/**
 * Preview of a coupon for the booking summary. The discount is recalculated
 * and enforced by /api/checkout_sessions; this only tells the guest what to expect.
 */
export async function POST(req: Request) {
  let lang: 'es' | 'en' = 'es';
  const reject = (reason: string, status: number, detail?: number) => NextResponse.json({ valid: false, reason, error: couponMessage(reason, lang, detail) }, { status });
  try {
    const body = await req.json();
    lang = body?.lang === 'en' ? 'en' : 'es';
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    if (limited(ip)) return reject('RATE_LIMITED', 429);
    const total = Number(body?.total);
    if (typeof body?.code !== 'string' || !Number.isFinite(total) || total <= 0 || total > 100_000_000) return reject('INVALID', 400);
    if (!(await couponsReady())) return reject('UNAVAILABLE', 503);
    const { coupon, discountMinor } = await usableCoupon(body.code, Math.round(total * 100));
    return NextResponse.json({
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minTotal: coupon.minTotal,
      discount: discountMinor / 100,
      total: (Math.round(total * 100) - discountMinor) / 100,
    });
  } catch (error) {
    if (error instanceof CouponError) return reject(error.reason, 200, error.detail);
    if (error instanceof SyntaxError) return reject('INVALID', 400);
    console.error('[Coupons] validation failed', error);
    return reject('UNAVAILABLE', 503);
  }
}

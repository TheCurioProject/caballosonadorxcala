/** Discount rule of a website coupon (shared by the server and the booking modal). */
export interface CouponRule {
  type: 'percent' | 'fixed';
  /** Percentage (1–100) or amount in MXN. */
  value: number;
  /** Minimum order total in MXN for the coupon to apply. */
  minTotal: number;
}

/** Discount in cents for an order of `totalMinor` cents; never more than the order. */
export function discountFor(rule: Pick<CouponRule, 'type' | 'value'>, totalMinor: number) {
  if (!Number.isFinite(totalMinor) || totalMinor <= 0) return 0;
  const raw = rule.type === 'percent' ? Math.round((totalMinor * rule.value) / 100) : Math.round(rule.value * 100);
  return Math.max(0, Math.min(totalMinor, raw));
}

/** Why a coupon was rejected, as the guest reads it. */
export function couponMessage(reason: string, lang: 'es' | 'en', detail?: number) {
  const amount = detail != null ? `$${detail.toLocaleString('en-US')} MXN` : '';
  const messages: Record<string, [string, string]> = {
    INVALID: ['Ese cupón no existe. Revisa que esté bien escrito.', 'That coupon does not exist. Check the spelling.'],
    INACTIVE: ['Ese cupón ya no está disponible.', 'That coupon is no longer available.'],
    NOT_STARTED: ['Ese cupón todavía no está vigente.', 'That coupon is not valid yet.'],
    EXPIRED: ['Ese cupón ya venció.', 'That coupon has expired.'],
    EXHAUSTED: ['Ese cupón ya alcanzó su límite de usos.', 'That coupon has reached its usage limit.'],
    MIN_TOTAL: [`Ese cupón aplica en reservas desde ${amount}.`, `That coupon applies to bookings from ${amount}.`],
    TOO_SMALL: ['Ese cupón no se puede aplicar a este importe.', 'That coupon cannot be applied to this amount.'],
    RATE_LIMITED: ['Demasiados intentos. Espera un momento.', 'Too many attempts. Please wait a moment.'],
    UNAVAILABLE: ['Los cupones no están disponibles en este momento.', 'Coupons are not available right now.'],
  };
  const pair = messages[reason] ?? messages.INVALID;
  return lang === 'en' ? pair[1] : pair[0];
}

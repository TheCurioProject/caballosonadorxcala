/** Discount rule of a website coupon (shared by the server and the booking modal). */
export type CouponType = 'percent' | 'fixed' | 'final';
export interface CouponRule {
  /** percent: % off · fixed: MXN off · final: the order costs exactly `value` MXN. */
  type: CouponType;
  /** Percentage (1–100), amount off in MXN, or final price in MXN. */
  value: number;
  /** Minimum order total in MXN for the coupon to apply. */
  minTotal: number;
}

/** Discount in cents for an order of `totalMinor` cents; never more than the order. */
export function discountFor(rule: Pick<CouponRule, 'type' | 'value'>, totalMinor: number) {
  if (!Number.isFinite(totalMinor) || totalMinor <= 0) return 0;
  const raw =
    rule.type === 'percent' ? Math.round((totalMinor * rule.value) / 100)
    : rule.type === 'final' ? totalMinor - Math.round(rule.value * 100)
    : Math.round(rule.value * 100);
  return Math.max(0, Math.min(totalMinor, raw));
}

/** How the coupon reads: "10% de descuento", "$500 MXN de descuento", "Precio final $50 MXN". */
export function couponRuleLabel(rule: Pick<CouponRule, 'type' | 'value'>, lang: 'es' | 'en') {
  const amount = `$${rule.value.toLocaleString('en-US')} MXN`;
  if (rule.type === 'percent') return lang === 'en' ? `${rule.value}% off` : `${rule.value}% de descuento`;
  if (rule.type === 'final') return lang === 'en' ? `Final price ${amount}` : `Precio final ${amount}`;
  return lang === 'en' ? `${amount} off` : `${amount} de descuento`;
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
    NO_SAVING: ['Esta reserva ya cuesta menos que el precio final de ese cupón.', 'This booking already costs less than the final price of that coupon.'],
    RATE_LIMITED: ['Demasiados intentos. Espera un momento.', 'Too many attempts. Please wait a moment.'],
    UNAVAILABLE: ['Los cupones no están disponibles en este momento.', 'Coupons are not available right now.'],
  };
  const pair = messages[reason] ?? messages.INVALID;
  return lang === 'en' ? pair[1] : pair[0];
}

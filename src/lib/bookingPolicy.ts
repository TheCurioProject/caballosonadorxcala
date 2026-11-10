// Stripe checkout expires after 30 minutes; allow five minutes for webhook delivery.
export const CHECKOUT_SECONDS = 30 * 60;
export const HOLD_MILLISECONDS = 35 * 60 * 1000;

export function activeBookingWhere(now = new Date()) {
  return {
    OR: [
      { payment_status: { in: ['CONFIRMED', 'PAID'] } },
      { payment_status: 'PENDING', createdAt: { gte: new Date(now.getTime() - HOLD_MILLISECONDS) } },
    ],
  };
}

export function activeServiceWhere(now = new Date()) {
  return {
    OR: [
      { paymentStatus: { in: ['CONFIRMED', 'PAID'] } },
      { paymentStatus: 'PENDING', createdAt: { gte: new Date(now.getTime() - HOLD_MILLISECONDS) } },
    ],
  };
}

export function parseCalendarDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function hotelToday(now = new Date()) {
  // en-CA locale formatting is not assumed to have a particular order.
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Mazatlan', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (name: string) => parts.find(part => part.type === name)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function validGuest(name: unknown, email: unknown, phone: unknown) {
  return typeof name === 'string' && name.trim().length >= 2 && name.length <= 255 &&
    typeof email === 'string' && email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    (phone === undefined || phone === null || (typeof phone === 'string' && phone.length <= 50));
}

export type CatalogItem = { id: number; name: string; price: number; isActive: boolean };
export type VerifiedItem = { type: string; name: string; quantity: number; unitPrice: number; price: number; details: string | null };

export function verifyAddon(addon: { type?: unknown; quantity?: unknown; details?: unknown }, food: CatalogItem[], tours: CatalogItem[]): VerifiedItem {
  if (typeof addon.type !== 'string' || addon.type.length > 50) throw new Error('INVALID_ADDON');
  const match = /^(FOOD_DISH|FOOD|TOUR)_(\d+)(?:_\d{4}-\d{2}-\d{2})?$/.exec(addon.type);
  if (!match) throw new Error('INVALID_ADDON');
  const item = (match[1] === 'TOUR' ? tours : food).find(item => item.id === Number(match[2]) && item.isActive);
  const quantity = addon.quantity ?? 1;
  if (!item || !Number.isFinite(item.price) || item.price < 0 || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 366) throw new Error('INVALID_ADDON');
  if (addon.details != null && (typeof addon.details !== 'string' || addon.details.length > 10000)) throw new Error('INVALID_ADDON');
  const unitPrice = Math.round(item.price * 100) / 100;
  return { type: addon.type, name: item.name, quantity, unitPrice, price: Math.round(unitPrice * quantity * 100) / 100, details: typeof addon.details === 'string' ? addon.details : null };
}

export function validateAddonDates(addons: VerifiedItem[], checkIn: string, checkOut: string) {
  for (const addon of addons) {
    const details = addon.details ? JSON.parse(addon.details) as Record<string,unknown> : {};
    const suffix = /_(\d{4}-\d{2}-\d{2})$/.exec(addon.type)?.[1];
    const date = details.date ?? suffix;
    if (date === undefined) continue; // A multi-day dinner package has dated dish entries.
    if (typeof date !== 'string' || !parseCalendarDate(date) || date < checkIn || date > checkOut || suffix && date !== suffix)
      throw new Error('ADDON_DATE_OUTSIDE_STAY');
  }
}

export function isActiveBookingRecord(booking: { payment_status: string; createdAt: Date | string }, now = new Date()) {
  return ['CONFIRMED', 'PAID'].includes(booking.payment_status) ||
    (booking.payment_status === 'PENDING' && new Date(booking.createdAt).getTime() >= now.getTime() - HOLD_MILLISECONDS);
}

export function isActiveServiceRecord(booking: { paymentStatus: string; createdAt: Date | string }, now = new Date()) {
  return ['CONFIRMED', 'PAID'].includes(booking.paymentStatus) ||
    (booking.paymentStatus === 'PENDING' && new Date(booking.createdAt).getTime() >= now.getTime() - HOLD_MILLISECONDS);
}

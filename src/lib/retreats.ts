/** Retreats: sold on the website with a room included (CALA → Retiros). */
export type Bilingual = { es: string; en: string };

export interface Retreat {
  id: number;
  title: Bilingual;
  summary: Bilingual;
  description: Bilingual;
  imageUrl: string | null;
  instructorName: string | null;
  instructorBio: Bilingual;
  instructorImageUrl: string | null;
  /** Arrival and departure (YYYY-MM-DD); the retreat closes the house in between. */
  startsOn: string | null;
  endsOn: string | null;
  /** How many times it can be sold (one booking = one room). */
  stock: number | null;
  /** Price of the retreat alone for one booking (MXN cents). The room is
   *  added on top at CALA's rates for the retreat's nights. */
  priceMinor: number | null;
  isActive: boolean;
}

export interface RetreatOffer {
  id: number;
  sold: number;
  onSale: boolean;
  /** `lodgingMinor`: the room's lodging price for the retreat's nights at CALA's rates (tax included). */
  rooms: Array<{ lodgingId: string; capacity: number; available: boolean; lodgingMinor?: number | null }>;
}

/** What a guest pays: the retreat price plus the room at CALA's rates. */
export function retreatTotal(priceMinor: number | null | undefined, lodgingMinor: number | null | undefined) {
  return (priceMinor ?? 0) + (lodgingMinor ?? 0);
}

/** Cheapest total among the rooms still free (null when none is). */
export function retreatFromTotal(retreat: Pick<Retreat, "priceMinor">, offer: RetreatOffer | undefined) {
  const free = (offer?.rooms ?? []).filter((r) => r.available && r.lodgingMinor != null);
  if (!retreat.priceMinor || !free.length) return null;
  return Math.min(...free.map((r) => retreatTotal(retreat.priceMinor, r.lodgingMinor)));
}

/** Places a guest can still buy: limited by the stock and by the free rooms. */
export function retreatRemaining(retreat: Pick<Retreat, "stock">, offer: RetreatOffer | undefined) {
  if (!offer?.onSale) return 0;
  const free = offer.rooms.filter((r) => r.available).length;
  return Math.max(0, Math.min((retreat.stock ?? 0) - offer.sold, free));
}

export const RETREAT_MAX_GUESTS = 2;

export function retreatText(value: Bilingual, lang: string) {
  return lang === "en" ? value.en || value.es : value.es || value.en;
}

const day = (iso: string) => new Date(iso + "T12:00:00Z");

export function retreatNights(startsOn: string | null, endsOn: string | null) {
  if (!startsOn || !endsOn) return 0;
  return Math.round((day(endsOn).getTime() - day(startsOn).getTime()) / 86400000);
}

/** "10 – 15 de marzo de 2027" / "March 10 – 15, 2027". */
export function retreatDates(startsOn: string | null, endsOn: string | null, lang: string) {
  if (!startsOn || !endsOn) return "";
  const locale = lang === "en" ? "en-US" : "es-MX";
  const a = day(startsOn);
  const b = day(endsOn);
  const opts = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...o });
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  const sameMonth = sameYear && a.getUTCMonth() === b.getUTCMonth();
  if (lang === "en") {
    if (sameMonth) return `${opts({ month: "long" }).format(a)} ${a.getUTCDate()} – ${b.getUTCDate()}, ${b.getUTCFullYear()}`;
    if (sameYear) return `${opts({ month: "long", day: "numeric" }).format(a)} – ${opts({ month: "long", day: "numeric" }).format(b)}, ${b.getUTCFullYear()}`;
    return `${opts({ dateStyle: "long" }).format(a)} – ${opts({ dateStyle: "long" }).format(b)}`;
  }
  if (sameMonth) return `${a.getUTCDate()} – ${b.getUTCDate()} de ${opts({ month: "long" }).format(b)} de ${b.getUTCFullYear()}`;
  if (sameYear) return `${opts({ day: "numeric", month: "long" }).format(a)} – ${opts({ day: "numeric", month: "long" }).format(b)} de ${b.getUTCFullYear()}`;
  return `${opts({ dateStyle: "long" }).format(a)} – ${opts({ dateStyle: "long" }).format(b)}`;
}

export function retreatPrice(minor: number, lang: string) {
  return (
    new Intl.NumberFormat(lang === "en" ? "en-US" : "es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: minor % 100 ? 2 : 0,
    }).format(minor / 100) + " MXN"
  );
}

/** "Solo 3 disponibles" — read from the database, never typed by hand. */
export function retreatAvailability(remaining: number, lang: string) {
  if (remaining <= 0) return lang === "en" ? "Sold out" : "Agotado";
  if (lang === "en") return remaining === 1 ? "Only 1 left" : `Only ${remaining} left`;
  return remaining === 1 ? "Solo 1 disponible" : `Solo ${remaining} disponibles`;
}

const errors: Record<string, Bilingual> = {
  RETREAT_SOLD_OUT: { es: "Este retiro se acaba de agotar.", en: "This retreat has just sold out." },
  RETREAT_ROOM_TAKEN: { es: "Esa habitación acaba de reservarse. Elige otra.", en: "That room was just booked. Please choose another one." },
  RETREAT_ROOM_CAPACITY: { es: "Esa habitación no admite ese número de personas.", en: "That room does not fit that many guests." },
  RETREAT_CLOSED: { es: "Este retiro ya no está a la venta.", en: "This retreat is no longer on sale." },
  RETREAT_GUESTS: { es: "Elige 1 o 2 personas.", en: "Choose 1 or 2 guests." },
  RETREAT_GUEST: { es: "Revisa tu nombre y tu correo.", en: "Please check your name and e-mail." },
  RETREAT_PRICE_CHANGED: { es: "El precio del retiro cambió. Recarga la página.", en: "The retreat price changed. Please reload the page." },
};
export const retreatErrorCodes = Object.keys(errors);
export function retreatError(code: string, lang: string) {
  const e = errors[code];
  return e ? retreatText(e, lang) : lang === "en" ? "We could not reserve the retreat. Please try again." : "No pudimos apartar el retiro. Inténtalo de nuevo.";
}

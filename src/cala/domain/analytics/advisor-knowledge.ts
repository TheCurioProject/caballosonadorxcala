/**
 * Knowledge bank for the CALA market agent. Plain data, no network: niche
 * playbooks with healthy ranges, and a demand calendar for Mexico (holidays,
 * school breaks, long weekends). The agent compares the property's own
 * history against these references and against imported competitor data.
 */
import type { Concept } from "@/cala/domain/model";

export interface NicheProfile {
  label: string;
  guests: string;
  targetOccupancy: number; // healthy yearly occupancy (0–1)
  directShareGoal: number; // healthy share of direct bookings (0–1)
  maxCancellation: number; // above this, policy needs attention
  weekendMinStay: number; // usual weekend minimum stay in the niche
  levers: string[]; // what usually moves bookings in this niche
}

const lodgingHome: NicheProfile = {
  label: "Casa o villa vacacional",
  guests: "Familias y grupos que buscan privacidad y estancias de varias noches",
  targetOccupancy: 0.55,
  directShareGoal: 0.3,
  maxCancellation: 0.15,
  weekendMinStay: 2,
  levers: [
    "Estancia mínima de 2–3 noches en fines de semana y temporada alta",
    "Descuento semanal (7+ noches) para competir con otras casas",
    "Fotos de áreas comunes y capacidad clara",
  ],
};
const boutique: NicheProfile = {
  label: "Hotel boutique / casa de huéspedes",
  guests: "Parejas y viajeros que buscan experiencia y trato cercano",
  targetOccupancy: 0.65,
  directShareGoal: 0.35,
  maxCancellation: 0.15,
  weekendMinStay: 2,
  levers: [
    "Venta directa con experiencias y comida como valor agregado",
    "Precio por día de la semana: fines de semana más altos",
    "Huéspedes recurrentes y reseñas recientes",
  ],
};
const hostel: NicheProfile = {
  label: "Hostal",
  guests: "Viajeros jóvenes y mochileros sensibles al precio",
  targetOccupancy: 0.7,
  directShareGoal: 0.2,
  maxCancellation: 0.2,
  weekendMinStay: 1,
  levers: ["Precio por cama dinámico", "Eventos y comunidad", "Última hora"],
};

export const niches: Record<Concept, NicheProfile> = {
  entire_home: lodgingHome,
  villas: lodgingHome,
  cabins: lodgingHome,
  glamping: boutique,
  apartments: lodgingHome,
  aparthotel: boutique,
  hotel: boutique,
  boutique_hotel: boutique,
  bed_and_breakfast: boutique,
  inn: boutique,
  resort: boutique,
  hostel,
  camping: hostel,
  multi_unit_complex: lodgingHome,
  other: boutique,
};

export interface DemandPeriod {
  start: string; // inclusive YYYY-MM-DD
  end: string; // inclusive
  label: string;
  level: "alta" | "media";
}

const iso = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const shift = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** Gregorian Easter (anonymous algorithm). */
function easter(y: number) {
  const a = y % 19,
    b = Math.floor(y / 100),
    c = y % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, month, day);
}
/** n-th weekday (0=Sun) of a month. */
function nthWeekday(y: number, m: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return iso(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
}
/** Long weekend (Sat–Mon) ending on a Monday holiday. */
const puente = (monday: string, label: string): DemandPeriod => ({
  start: shift(monday, -2),
  end: monday,
  label,
  level: "media",
});

/** Mexican leisure-travel demand calendar for a year. */
export function demandCalendar(y: number): DemandPeriod[] {
  const e = easter(y);
  return [
    { start: iso(y, 1, 1), end: iso(y, 1, 6), label: "Año Nuevo y Reyes", level: "alta" },
    puente(nthWeekday(y, 2, 1, 1), "Puente del Día de la Constitución"),
    { start: iso(y, 2, 12), end: iso(y, 2, 15), label: "San Valentín", level: "media" },
    puente(nthWeekday(y, 3, 1, 3), "Puente de Benito Juárez"),
    { start: shift(e, -7), end: shift(e, 7), label: "Semana Santa y Pascua", level: "alta" },
    { start: iso(y, 7, 15), end: iso(y, 8, 20), label: "Vacaciones de verano", level: "alta" },
    { start: iso(y, 9, 13), end: iso(y, 9, 16), label: "Fiestas patrias", level: "media" },
    { start: iso(y, 10, 31), end: iso(y, 11, 2), label: "Día de Muertos", level: "media" },
    puente(nthWeekday(y, 11, 1, 3), "Puente de la Revolución"),
    { start: iso(y, 12, 18), end: iso(y, 12, 31), label: "Navidad y fin de año", level: "alta" },
  ];
}
export function demandOn(date: string): DemandPeriod | null {
  const y = Number(date.slice(0, 4));
  return (
    [...demandCalendar(y - 1), ...demandCalendar(y)].find(
      (p) => date >= p.start && date <= p.end,
    ) ?? null
  );
}
/** Low season for Mexican beach/leisure destinations (rough reference). */
export function isLowSeason(date: string) {
  const md = date.slice(5);
  return (md >= "09-01" && md <= "10-25") || (md >= "05-15" && md <= "06-30");
}

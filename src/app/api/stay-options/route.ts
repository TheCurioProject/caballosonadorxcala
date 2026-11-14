import { NextResponse } from "next/server";
import { calaConfiguration } from "@/lib/cala/config";
import { hotelToday, parseCalendarDate } from "@/lib/bookingPolicy";
import { getLodgingAvailability, getLodgings, quoteErrorCode, quoteLodging } from "@/lib/lodgings.server";
import { planStay } from "@/lib/stayPlanner";
import { stayCandidates, type StaySuggestion, type SuggestLodging } from "@/lib/staySuggestions";
import type { Lodging } from "@/lib/lodgings";
export const dynamic = "force-dynamic";

/**
 * Searches every lodging CALA sells on the website for a stay and recommends
 * how to accommodate the group. Each lodging is quoted by CALA itself (rules,
 * closures, inventory, rates); the planner only combines what is bookable.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const start = query.get("checkIn"), end = query.get("checkOut");
  const adults = Number(query.get("adults")), children = Number(query.get("children") ?? 0);
  const arrival = parseCalendarDate(start), departure = parseCalendarDate(end);
  if (
    !arrival || !departure || !start || !end || start < hotelToday() ||
    departure.getTime() - arrival.getTime() < 86400000 ||
    departure.getTime() - arrival.getTime() > 366 * 86400000 ||
    !Number.isInteger(adults) || !Number.isInteger(children) ||
    adults < 1 || children < 0 || adults + children > 60
  )
    return NextResponse.json({ error: "Selecciona fechas y un número válido de huéspedes." }, { status: 400 });
  if (!calaConfiguration().ready)
    return NextResponse.json({ error: "Las reservas están en preparación. Contacta al alojamiento." }, { status: 503 });
  try {
    const catalog = await getLodgings();
    const results = await Promise.all(
      catalog.map(async (l) => {
        try {
          const totalMinor = await quoteLodging({ lodgingId: l.id, adults: 1, children: 0 }, arrival, departure);
          return { lodgingId: l.id, available: true as const, totalMinor };
        } catch (error) {
          return { lodgingId: l.id, available: false as const, code: quoteErrorCode(error) };
        }
      }),
    );
    const bookable = results.flatMap((r) => {
      const l = catalog.find((c) => c.id === r.lodgingId)!;
      return r.available ? [{ id: l.id, kind: l.kind, capacity: l.capacity, totalMinor: r.totalMinor, sortOrder: l.sortOrder }] : [];
    });
    const options = planStay(bookable, adults, children);
    // Nothing fits: look for the closest stays that do, keeping the guest's group and nights.
    const alternatives = options.length ? null : await suggest(catalog, start, Math.round((departure.getTime() - arrival.getTime()) / 86400000), adults, children).catch(() => null);
    // How many people could still stay on the requested dates (a smaller group may fit).
    const freeRooms = bookable.filter((l) => l.kind === "room");
    const sameDatesCapacity = options.length ? null : Math.max(freeRooms.reduce((sum, l) => sum + l.capacity, 0), bookable.find((l) => l.kind === "whole_home")?.capacity ?? 0);
    return NextResponse.json(
      { checkIn: start, checkOut: end, adults, children, currency: catalog[0]?.currency ?? "MXN", lodgings: results, options,
        ...(alternatives ? { suggestions: alternatives, sameDatesCapacity } : {}) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "No se pudo consultar la disponibilidad. Inténtalo de nuevo." }, { status: 503 });
  }
}

/**
 * Closest bookable stays for the same group. Candidates come from the public
 * availability ranges; each one is then quoted by CALA, so only stays that can
 * really be booked (rules, closures, rates) are suggested, with their price.
 */
async function suggest(catalog: Lodging[], checkIn: string, nights: number, adults: number, children: number): Promise<StaySuggestion[]> {
  const day = (value: string | Date) => (typeof value === "string" ? value : value.toISOString()).slice(0, 10);
  const previous = (value: string) => new Date(Date.parse(day(value) + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
  const availability = await Promise.all(catalog.map(async (l) => ({ lodging: l, data: await getLodgingAvailability(l.id) })));
  const lodgings: SuggestLodging[] = availability.map(({ lodging, data }) => ({
    id: lodging.id, kind: lodging.kind, capacity: lodging.capacity, sortOrder: lodging.sortOrder,
    minStay: data.minStay, maxStay: data.maxStay, leadTimeDays: data.leadTimeDays, openThrough: data.openThrough,
    busy: [
      ...data.reservations.filter((r) => r.checkOut > r.checkIn).map((r) => ({ from: day(r.checkIn), to: previous(r.checkOut) })),
      ...data.blocks.map((b) => ({ from: day(b.startDate), to: day(b.endDate) })),
      ...data.salesClosures.map((b) => ({ from: day(b.startDate), to: day(b.endDate) })),
      ...data.pricingRules.filter((r) => r.closed).map((r) => ({ from: day(r.date), to: day(r.date) })),
    ].filter((r) => r.to >= r.from),
  }));
  const today = availability[0]?.data.today ?? hotelToday();
  const candidates = stayCandidates({ lodgings, today, checkIn, nights, adults, children });
  const suggestions: StaySuggestion[] = [];
  for (const candidate of candidates) {
    if (suggestions.length >= 3) break;
    const arrival = parseCalendarDate(candidate.checkIn), departure = parseCalendarDate(candidate.checkOut);
    if (!arrival || !departure) continue;
    const quoted = await Promise.all(
      candidate.lodgingIds.map(async (id) => {
        const l = catalog.find((c) => c.id === id)!;
        try {
          return { id, kind: l.kind, capacity: l.capacity, sortOrder: l.sortOrder, totalMinor: await quoteLodging({ lodgingId: id, adults: 1, children: 0 }, arrival, departure) };
        } catch {
          return null; // a rule the ranges do not show (minimum stay of a date, closed arrival…)
        }
      }),
    );
    const option = planStay(quoted.filter((q): q is NonNullable<typeof q> => q !== null), adults, children, 1)[0];
    if (option) suggestions.push({ checkIn: candidate.checkIn, checkOut: candidate.checkOut, nights: candidate.nights, shiftDays: candidate.shiftDays, nightsDelta: candidate.nightsDelta, option });
  }
  return suggestions;
}

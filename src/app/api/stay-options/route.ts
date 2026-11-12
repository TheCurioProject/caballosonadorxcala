import { NextResponse } from "next/server";
import { calaConfiguration } from "@/lib/cala/config";
import { hotelToday, parseCalendarDate } from "@/lib/bookingPolicy";
import { getLodgings, quoteErrorCode, quoteLodging } from "@/lib/lodgings.server";
import { planStay } from "@/lib/stayPlanner";
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
    return NextResponse.json(
      { checkIn: start, checkOut: end, adults, children, currency: catalog[0]?.currency ?? "MXN", lodgings: results, options: planStay(bookable, adults, children) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "No se pudo consultar la disponibilidad. Inténtalo de nuevo." }, { status: 503 });
  }
}

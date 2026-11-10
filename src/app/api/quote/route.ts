import { calaConfiguration } from "@/lib/cala/config";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseCalendarDate, hotelToday } from "@/lib/bookingPolicy";
import { expandRecurringPricing } from "@/lib/pricing";
import { lodgingSelectionSchema } from '@/lib/lodgings';
import { getLodgings, quoteLodging } from '@/lib/lodgings.server';
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams,
    start = query.get("checkIn"),
    end = query.get("checkOut");
  const arrival = parseCalendarDate(start),
    departure = parseCalendarDate(end);
  if (
    !arrival ||
    !departure ||
    !start ||
    !end ||
    start < hotelToday() ||
    departure.getTime() - arrival.getTime() < 86400000 ||
    departure.getTime() - arrival.getTime() > 366 * 86400000
  )
    return NextResponse.json(
      { error: "Selecciona una estancia válida de al menos dos noches." },
      { status: 400 },
    );
  if (!calaConfiguration().ready)
    return NextResponse.json(
      { error: "Las reservas están en preparación. Contacta al alojamiento." },
      { status: 503 },
    );
  try {
    const catalog = await getLodgings();
    if (catalog.length || query.has('lodgingId')) {
      const selection = lodgingSelectionSchema.safeParse({lodgingId: query.get('lodgingId'), adults: Number(query.get('adults') ?? 1), children: Number(query.get('children') ?? 0)});
      if (!selection.success || !catalog.some(l => l.id === selection.data.lodgingId))
        return NextResponse.json({error: 'Selecciona un alojamiento y un número válido de huéspedes.'}, {status: 400});
      const totalMinor = await quoteLodging(selection.data, arrival, departure);
      return NextResponse.json({checkIn: start, checkOut: end, lodgingId: selection.data.lodgingId, totalMinor, currency: 'MXN'}, {headers: {'Cache-Control': 'no-store'}});
    }
    if (departure.getTime() - arrival.getTime() < 2 * 86400000)
      return NextResponse.json({error: 'La estancia mínima es de dos noches.'}, {status: 400});
    const property = await prisma.property.findFirst({
      where: { isActive: true },
      include: { pricingRules: true },
    });
    if (!property) throw new Error("SETUP_REQUIRED");
    let totalMinor = 0;
    if (process.env.DATA_BACKEND === "supabase") {
      const result = await prisma.$queryRaw<
        Array<{ total: bigint }>
      >`SELECT site.cala_quote(${property.id}::integer,${arrival}::date,${departure}::date) AS total`;
      if (!result[0]) throw new Error("SETUP_REQUIRED");
      totalMinor = Number(result[0].total);
    } else {
      const rates = expandRecurringPricing(property.pricingRules);
      for (
        let current = new Date(arrival);
        current < departure;
        current.setUTCDate(current.getUTCDate() + 1)
      ) {
        const rule = rates.find(
          (row) =>
            new Date(row.date).toISOString().slice(0, 10) ===
            current.toISOString().slice(0, 10),
        );
        totalMinor += Math.round(
          (rule?.priceOverride ?? property.basePrice) * 100,
        );
      }
    }
    return NextResponse.json(
      { checkIn: start, checkOut: end, totalMinor, currency: "MXN" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // Explain which CALA rule rejected the stay (rates & restrictions grid,
    // lodging rules, sales closures or inventory) instead of a generic error.
    const text = String((error as { message?: string })?.message ?? "");
    const code =
      ["RATE_RESTRICTION", "DEPARTURE_CLOSED", "LODGING_SALES_CLOSED", "LODGING_RULES", "OCCUPANCY", "INVENTORY", "UNAVAILABLE"].find((c) => text.includes(c)) ?? "QUOTE_FAILED";
    const messages: Record<string, string> = {
      RATE_RESTRICTION: "Alguna noche de esta estancia está cerrada o no cumple la estancia mínima/máxima o el cierre a la llegada.",
      DEPARTURE_CLOSED: "No se permiten salidas en la fecha elegida. Prueba otra fecha de salida.",
      LODGING_SALES_CLOSED: "Las ventas están cerradas en esas fechas.",
      LODGING_RULES: "Las fechas no cumplen las reglas de reserva (anticipación, estancia mínima o máxima).",
    };
    return NextResponse.json(
      {
        code,
        error:
          messages[code] ??
          "No se puede cotizar esta estancia. Revisa las fechas o inténtalo de nuevo.",
      },
      { status: 409 },
    );
  }
}

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { calaConfiguration } from "@/lib/cala/config";
import { activeServiceWhere } from "@/lib/bookingPolicy";
import { getLodgingAvailability, getLodgings } from "@/lib/lodgings.server";
export const dynamic = "force-dynamic";

const previousDay = (day: string) =>
  new Date(Date.parse(day.slice(0, 10) + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);

/**
 * Read-only "at a glance" availability of the house and every room, for the
 * first screen of the booking modal. Only date ranges leave the server (never
 * guests or reservation details). Ranges are inclusive nights (yyyy-MM-dd).
 */
export async function GET() {
  if (!calaConfiguration().ready)
    return NextResponse.json({ error: "Las reservas están en preparación." }, { status: 503 });
  try {
    const catalog = await getLodgings();
    const [rows, serviceBlocks, tours] = await Promise.all([
      Promise.all(catalog.map(async (l) => ({ id: l.id, data: await getLodgingAvailability(l.id) }))),
      prisma.serviceBlockedDate.findMany({ where: { endDate: { gte: new Date() } } }).catch(() => []),
      prisma.serviceBooking.findMany({ where: { serviceType: "TOUR", ...activeServiceWhere(), endDate: { gte: new Date() } } }).catch(() => []),
    ]);
    const day = (value: string | Date) => (typeof value === "string" ? value : value.toISOString()).slice(0, 10);
    const tourBookedDates: string[] = [];
    for (const tour of tours)
      for (let d = new Date(tour.startDate); d <= new Date(tour.endDate); d.setUTCDate(d.getUTCDate() + 1))
        tourBookedDates.push(d.toISOString().slice(0, 10));
    return NextResponse.json(
      {
        today: rows[0]?.data.today ?? new Date().toISOString().slice(0, 10),
        lodgings: rows.map(({ id, data }) => ({
          id,
          booked: data.reservations
            .filter((r) => r.checkOut > r.checkIn)
            .map((r) => ({ from: day(r.checkIn), to: previousDay(r.checkOut) })),
          blocked: [
            ...data.blocks.map((b) => ({ from: day(b.startDate), to: day(b.endDate) })),
            ...data.salesClosures.map((b) => ({ from: day(b.startDate), to: day(b.endDate) })),
            ...data.pricingRules.filter((r) => r.closed).map((r) => ({ from: day(r.date), to: day(r.date) })),
          ].filter((r) => r.to >= r.from),
          openThrough: data.openThrough,
          leadTimeDays: data.leadTimeDays,
          minStay: data.minStay,
        })),
        foodBlockedRanges: serviceBlocks.filter((b) => b.serviceType === "FOOD").map((b) => ({ from: day(b.startDate), to: day(b.endDate) })),
        tourBlockedRanges: serviceBlocks.filter((b) => b.serviceType === "TOUR").map((b) => ({ from: day(b.startDate), to: day(b.endDate) })),
        tourBookedDates,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "No se pudo consultar la disponibilidad." }, { status: 503 });
  }
}

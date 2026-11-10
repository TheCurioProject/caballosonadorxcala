import { createHash } from "node:crypto";
import prisma from "@/lib/prisma";
import { calaConfiguration } from "./config";
import { exportCalendar } from "@/cala/domain/distribution/ical";
/** Existing subscription URLs stay valid, but expose only opaque busy events from CALA. */
export async function legacyCalendar(propertyId: string | null) {
  if (!propertyId || !/^[1-9]\d{0,8}$/.test(propertyId))
    return new Response("Invalid property", { status: 400 });
  if (!calaConfiguration().ready)
    return new Response("Calendar unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  try {
    const result = await prisma.$queryRaw<
      Array<{
        events: Array<{
          kind: string;
          id: string;
          arrival: string;
          departure: string;
          sequence: number;
        }>;
      }>
    >`SELECT site.legacy_calendar(${Number(propertyId)}::integer) AS events`;
    if (!result[0]) return new Response("Not found", { status: 404 });
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
    const events = result[0].events.map((row) => ({
      uid:
        createHash("sha256")
          .update("cala:legacy:" + row.kind + ":" + row.id)
          .digest("hex") + "@cala.local",
      arrival: row.arrival,
      departure: row.departure,
      sequence: Number(row.sequence),
      stamp: "",
      cancelled: false,
      own: true,
    }));
    return new Response(exportCalendar(events, stamp), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Disposition": 'attachment; filename="disponibilidad.ics"',
      },
    });
  } catch {
    return new Response("Calendar unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

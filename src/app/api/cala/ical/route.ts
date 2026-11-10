import { failure } from "@/cala/infrastructure/http/server";
import { publicCalendar } from "@/cala/infrastructure/public-calendar";
import { exportCalendar } from "@/cala/domain/distribution/ical";

export async function GET(request: Request) {
  try {
    const calendar = await publicCalendar(
      request,
      new URL(request.url).searchParams.get("token") ?? "",
    );
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
    return new Response(
      exportCalendar(
        calendar.events
          .filter((e) => e.exportable)
          .map((e) => ({ ...e, stamp: "", own: true })),
        stamp,
      ),
      {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
          "Content-Disposition": 'attachment; filename="disponibilidad.ics"',
        },
      },
    );
  } catch (error) {
    return failure(error);
  }
}

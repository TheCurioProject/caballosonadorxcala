import { legacyCalendar } from "@/lib/cala/legacy-ical";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return legacyCalendar(new URL(request.url).searchParams.get("propertyId"));
}

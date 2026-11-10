import { legacyCalendar } from "@/lib/cala/legacy-ical";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  return legacyCalendar((await params).propertyId);
}

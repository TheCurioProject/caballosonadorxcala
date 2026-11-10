import { redirect } from "next/navigation";
// External iCal calendars are managed in CALA → Canales (import and export).
// The legacy feeds keep syncing through the cron job; only the duplicate
// management screen was retired.
export default function Page() {
  redirect("/admin/canales");
}

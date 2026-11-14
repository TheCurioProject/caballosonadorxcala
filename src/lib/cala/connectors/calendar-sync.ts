import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdminClient } from "@/cala/infrastructure/supabase/admin";
import { DomainError } from "@/cala/domain/shared/errors";
import { bookedEvents, fetchCalendar, parseOtaCalendar } from "./ical-feed";

export interface SyncResult {
  ok: boolean;
  error?: string;
  events?: number;
  active?: number;
  created?: number;
  updated?: number;
  released?: number;
  /** OTA availability marks ("Airbnb (Not available)") that were not imported. */
  ignored?: number;
  conflicts?: { code: string; arrival: string; departure: string; source: string }[];
}
type LinkRow = { id: string; url: string; property_id: string; last_sync_at: string | null };

// New tables are outside the generated Database types.
export const untyped = (client: unknown) => client as SupabaseClient;

/** Downloads one OTA calendar and applies it. Errors are recorded, never thrown. */
export async function syncCalendarLink(linkId: string): Promise<SyncResult> {
  const admin = untyped(supabaseAdminClient());
  const { data: rows, error } = await admin.rpc("pms_service_calendar_links", {
    only_link: linkId,
  });
  if (error || !rows?.length)
    throw new DomainError("NOT_FOUND", "La conexión de calendario ya no existe.", 404);
  return applyLink(admin, rows[0] as LinkRow);
}

async function applyLink(admin: SupabaseClient, link: LinkRow): Promise<SyncResult> {
  let events: unknown = [];
  let failure: string | null = null;
  let ignored = 0;
  try {
    const all = parseOtaCalendar(await fetchCalendar(link.url));
    // Only real bookings close dates. Availability marks are dropped here, so
    // blocks a previous sync created from them are released by the apply step.
    const booked = bookedEvents(all);
    ignored = all.filter((e) => !e.cancelled).length - booked.filter((e) => !e.cancelled).length;
    events = booked.map(({ uid, arrival, departure, cancelled }) => ({ uid, arrival, departure, cancelled }));
  } catch (e) {
    failure = e instanceof DomainError ? e.message : "No pudimos leer el calendario.";
  }
  const { data, error } = await admin.rpc("pms_service_calendar_apply", {
    link: link.id,
    events,
    failure,
  });
  if (error) return { ok: false, error: "No pudimos guardar el calendario. Inténtalo de nuevo." };
  return { ...(data as SyncResult), ignored };
}

/** Cron: every link, oldest first, within the time budget. */
export async function syncAllCalendarLinks(budgetMs = 45000) {
  const started = Date.now();
  const admin = untyped(supabaseAdminClient());
  const { data, error } = await admin.rpc("pms_service_calendar_links", { only_link: null });
  if (error) throw new Error("calendar links unavailable");
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const link of (data ?? []) as LinkRow[]) {
    if (Date.now() - started > budgetMs) break;
    const r = await applyLink(admin, link);
    results.push({ id: link.id, ok: r.ok, error: r.error });
  }
  return { total: (data ?? []).length, synced: results.length, failed: results.filter((r) => !r.ok).length };
}

/** Records that an OTA (or anyone holding the link) downloaded an export feed. */
export async function recordFeedFetch(token: string, agent: string) {
  try {
    await untyped(supabaseAdminClient()).rpc("pms_service_feed_touch", {
      token,
      agent: agent.slice(0, 300),
    });
  } catch {
    /* tracking must never break the feed */
  }
}

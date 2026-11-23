import { supabaseAdminClient } from "@/cala/infrastructure/supabase/admin";
import { untyped } from "./connectors/calendar-sync";

/**
 * Reservation trash: stays deleted in CALA are kept 10 days so they can be
 * recovered; after that the database deletes them for good. Called by the
 * 5-minute cron (the trash commands in CALA also empty what is due).
 */
export async function purgeReservationTrash(options: { max?: number } = {}) {
  const admin = untyped(supabaseAdminClient());
  const { data, error } = await admin.rpc("pms_service_purge_reservation_trash", {
    max_items: options.max ?? 50,
  });
  if (error) throw new Error(`reservation trash purge failed: ${error.message}`);
  return { purged: Number(data ?? 0) };
}

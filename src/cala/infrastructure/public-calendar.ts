import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/cala/infrastructure/db/database.types";
import {
  calendarToken,
  publicCalendarSchema,
} from "@/cala/application/public-calendar";
import { supabasePublicConfig } from "@/lib/cala/config";
import { invariant } from "@/cala/domain/shared/errors";

export async function publicCalendar(request: Request, token: string) {
  invariant(
    calendarToken.test(token),
    "NOT_FOUND",
    "Enlace no disponible.",
    404,
  );
  const { url, key } = supabasePublicConfig();
  invariant(url && key, "SETUP_REQUIRED", "Configura Supabase.", 503);
  {
    // Never forward operator cookies or a service role to the anonymous capability reader.
    const client = createClient<Database>(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data, error } = await client.rpc("pms_public_calendar", { token });
    invariant(
      !error || error.message !== "NOT_FOUND",
      "NOT_FOUND",
      "Enlace no disponible.",
      404,
    );
    invariant(
      !error,
      "CALENDAR_UNAVAILABLE",
      "No pudimos consultar la disponibilidad. Inténtalo de nuevo.",
      503,
    );
    return publicCalendarSchema.parse(data);
  }
}

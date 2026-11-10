import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/cala/infrastructure/db/database.types";
import { invariant } from "@/cala/domain/shared/errors";

/**
 * Service-role admin client — privileged operations only.
 * NEVER expose the return value or any data it touches to the browser.
 */
export function supabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  invariant(
    url && key,
    "SUPABASE_NOT_CONFIGURED",
    "Falta configurar SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.",
    503,
  );
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}


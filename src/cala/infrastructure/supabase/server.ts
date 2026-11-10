import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/cala/infrastructure/db/database.types";
import { invariant } from "@/cala/domain/shared/errors";
/** Request-scoped client using the user's JWT; never use service-role for UI requests. */
export async function supabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  invariant(
    url && key,
    "SUPABASE_NOT_CONFIGURED",
    "Falta configurar Supabase.",
    503,
  );
  const jar = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values)
            jar.set(name, value, options);
        } catch {
          /* Server Components rely on the proxy to persist refreshed cookies. */
        }
      },
    },
  });
}

import { supabaseServerClient } from "@/cala/infrastructure/supabase/server";
import { calaConfiguration } from "./config";
import { invariant } from "@/cala/domain/shared/errors";
/** Session identity is verified remotely; membership is rechecked on every request. */
export async function requireCalaAccess(
  existingClient?: Awaited<ReturnType<typeof supabaseServerClient>>,
) {
  invariant(
    calaConfiguration().ready,
    "SETUP_REQUIRED",
    "Completa la configuración de Supabase para abrir el panel.",
    503,
  );
  const client = existingClient ?? (await supabaseServerClient());
  const { data, error } = await client.auth.getUser();
  invariant(
    !error && data.user,
    "UNAUTHORIZED",
    "Inicia sesión para continuar.",
    401,
  );
  const organizationId = process.env.CALA_ORGANIZATION_ID!;
  const { data: member, error: memberError } = await client
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .maybeSingle();
  invariant(
    !memberError,
    "ACCESS_UNAVAILABLE",
    "No se pudo verificar tu acceso.",
    503,
  );
  invariant(
    member,
    "FORBIDDEN",
    "Tu cuenta no tiene acceso a Casa Caballo Soñador.",
    403,
  );
  const { data: organization, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .eq("status", "active")
    .maybeSingle();
  invariant(
    !organizationError,
    "ACCESS_UNAVAILABLE",
    "No se pudo verificar el alojamiento.",
    503,
  );
  invariant(organization, "FORBIDDEN", "Este alojamiento no está activo.", 403);
  return { client, user: data.user, member, organizationId };
}

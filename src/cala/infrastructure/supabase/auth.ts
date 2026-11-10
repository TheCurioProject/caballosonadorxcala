import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/cala/infrastructure/db/database.types";
import { invariant } from "@/cala/domain/shared/errors";
/** Verified server identity. RPC authorization still uses auth.uid(), never a client actorId. */
export class SupabaseAuthAdapter {
  constructor(private client: SupabaseClient<Database>) {}
  async resolve() {
    const { data, error } = await this.client.auth.getUser();
    invariant(
      !error && data.user,
      "UNAUTHORIZED",
      "Inicia sesión para continuar.",
      401,
    );
    return { userId: data.user.id };
  }
  async signOut() {
    const { error } = await this.client.auth.signOut();
    invariant(!error, "SIGN_OUT_FAILED", "No se pudo cerrar sesión.", 503);
  }
  async requireMfa() {
    const { data, error } =
      await this.client.auth.mfa.getAuthenticatorAssuranceLevel();
    invariant(
      !error && data?.currentLevel === "aal2",
      "MFA_REQUIRED",
      "Confirma tu identidad mediante MFA.",
      403,
    );
  }
}

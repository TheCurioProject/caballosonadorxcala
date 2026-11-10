import { NextResponse } from "next/server";
import { z } from "zod";
import { body, failure } from "@/cala/infrastructure/http/server";
import { assertOrigin } from "@/cala/lib/runtime";
import { requireCalaAccess } from "@/lib/cala/access";
import { invariant } from "@/cala/domain/shared/errors";
import { roles } from "@/cala/application/schemas";
import { canManageRole } from "@/cala/domain/identity/permissions";
import type { Role } from "@/cala/domain/model";
import { supabaseAdminClient } from "@/cala/infrastructure/supabase/admin";
import { SupabaseCommandGateway } from "@/cala/infrastructure/supabase/commands";

const inviteSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.email(),
  role: z.enum(roles),
  propertyIds: z.array(z.string().min(1).max(100)).max(100),
  // Optional temporary password: the person can sign in right away. Without
  // it Supabase emails an invitation link instead.
  password: z.union([z.string().min(8).max(72), z.literal("")]).optional(),
});

/**
 * Adds a team member in two steps: make sure a Supabase Auth account exists
 * for the email (service role), then create the membership through
 * pms_command, which re-checks the inviter's rights in the database.
 */
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { client, organizationId, member } = await requireCalaAccess();
    const input = inviteSchema.parse(await body(request));
    const { data: actorRole } = await client
      .from("roles")
      .select("key")
      .eq("id", member.role_id)
      .maybeSingle();
    invariant(
      actorRole && canManageRole(actorRole.key as Role, input.role),
      "ROLE_ESCALATION",
      "Sólo puedes asignar roles por debajo del tuyo.",
      403,
    );
    const email = input.email.toLowerCase();
    const admin = supabaseAdminClient();
    let warning: string | undefined;
    if (input.password) {
      const { error } = await admin.auth.admin.createUser({
        email,
        password: input.password,
        email_confirm: true,
        user_metadata: { name: input.name },
      });
      if (error && !/already/i.test(error.message))
        invariant(false, "INVITE_FAILED", "No se pudo crear la cuenta.", 503);
      if (error)
        warning = "Esa persona ya tenía cuenta: conserva su contraseña actual.";
    } else {
      const { error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { name: input.name },
        redirectTo: new URL("/admin/login/", request.url).toString(),
      });
      if (error && !/already/i.test(error.message))
        invariant(
          false,
          "INVITE_FAILED",
          "No se pudo enviar la invitación. Prueba con una contraseña temporal.",
          503,
        );
    }
    const result = await new SupabaseCommandGateway(client).execute(
      {
        type: "team.invite",
        organizationId,
        name: input.name,
        email,
        role: input.role,
        propertyIds: input.propertyIds,
      },
      request.headers.get("Idempotency-Key") || crypto.randomUUID(),
    );
    return NextResponse.json({
      ...result,
      message: input.password
        ? "Miembro añadido. Ya puede iniciar sesión con su correo y la contraseña temporal."
        : "Miembro añadido. Le enviamos un correo para activar su cuenta.",
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    return failure(error);
  }
}

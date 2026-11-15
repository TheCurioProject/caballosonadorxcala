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
import { findUserByEmail } from "@/lib/cala/signup-verification";
import { issueInvite, sendInviteEmail } from "@/lib/cala/team-invitation";

function requestLocale(request: Request): "es" | "en" {
  return /(?:^|;\s*)cala-locale=en(?:;|$)/.test(
    request.headers.get("cookie") ?? "",
  )
    ? "en"
    : "es";
}

const inviteSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.email(),
  role: z.enum(roles),
  propertyIds: z.array(z.string().min(1).max(100)).max(100),
  // Optional temporary password: the person can sign in right away. Without
  // it CALA emails a one-time invitation link (see team-invitation.ts).
  password: z.union([z.string().min(8).max(72), z.literal("")]).optional(),
});

/**
 * Adds a team member: make sure a Supabase Auth account exists for the email
 * (service role), create the membership through pms_command, which re-checks
 * the inviter's rights in the database, and email the invitation link.
 */
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { client, organizationId, member, user } = await requireCalaAccess();
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
    // 1. Make sure the Auth account exists. Without a temporary password it
    //    stays unconfirmed until the person accepts the invitation link.
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        ...(input.password ? { password: input.password } : {}),
        email_confirm: Boolean(input.password),
        user_metadata: { name: input.name },
      });
    let account = created?.user ?? null;
    if (createError) {
      invariant(
        /already|registered|exists/i.test(createError.message),
        "INVITE_FAILED",
        "No se pudo crear la cuenta. Intenta de nuevo.",
        503,
      );
      account = await findUserByEmail(admin, email);
      invariant(account, "INVITE_FAILED", "No se pudo crear la cuenta.", 503);
      if (account.email_confirmed_at) {
        if (input.password)
          warning = "Esa persona ya tenía cuenta: conserva su contraseña actual.";
      }
    }
    // 2. Membership through pms_command (re-checks the inviter's rights).
    //    Inviting someone who is already in the team only resends the link.
    const { data: existing } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("user_id", account!.id)
      .maybeSingle();
    invariant(
      !existing || !account!.email_confirmed_at,
      "DUPLICATE_MEMBER",
      "Esa persona ya forma parte del equipo.",
      409,
    );
    if (input.password && !account!.email_confirmed_at) {
      // Pending invitation, now with a temporary password: activate it.
      const { error } = await admin.auth.admin.updateUserById(account!.id, {
        password: input.password,
        email_confirm: true,
        app_metadata: { ...account!.app_metadata, cala_invite: null },
      });
      invariant(!error, "INVITE_FAILED", "No se pudo crear la cuenta.", 503);
      account!.email_confirmed_at = new Date().toISOString();
    }
    const result = existing
      ? { message: "Invitación reenviada" }
      : await new SupabaseCommandGateway(client).execute(
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
    if (account!.email_confirmed_at)
      return NextResponse.json({
        ...result,
        message: input.password && !warning
          ? "Miembro añadido. Ya puede iniciar sesión con su correo y la contraseña temporal."
          : "Miembro añadido. Ya puede iniciar sesión con su cuenta de siempre.",
        ...(warning ? { warning } : {}),
      });
    // 3. One-time link, emailed through Resend. If the email can't be sent
    //    the inviter gets the link to share by hand.
    const inviteLink = await issueInvite(
      admin,
      account!,
      new URL(request.url).origin,
    );
    const inviter = String(
      user.user_metadata?.name || user.email?.split("@")[0] || "Tu equipo",
    );
    const sent = await sendInviteEmail({
      to: email,
      name: input.name,
      inviter,
      link: inviteLink,
      locale: requestLocale(request),
    });
    return NextResponse.json({
      ...result,
      inviteLink,
      emailSent: sent,
      message: !sent
        ? "No se pudo enviar el correo. Copia el enlace de invitación y compártelo."
        : existing
          ? "Le reenviamos el correo de invitación."
          : "Miembro añadido. Le enviamos un correo para activar su cuenta.",
    });
  } catch (error) {
    return failure(error);
  }
}

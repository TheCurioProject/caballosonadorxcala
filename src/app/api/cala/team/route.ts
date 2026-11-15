import { NextResponse } from "next/server";
import { z } from "zod";
import { body, failure } from "@/cala/infrastructure/http/server";
import { assertOrigin } from "@/cala/lib/runtime";
import { requireCalaAccess } from "@/lib/cala/access";
import { invariant } from "@/cala/domain/shared/errors";
import { roles } from "@/cala/application/schemas";
import { canManageRole } from "@/cala/domain/identity/permissions";
import type { Role } from "@/cala/domain/model";
import type { User } from "@supabase/supabase-js";
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
});

/** Issues a fresh activation link and emails it (see team-invitation.ts). */
async function sendActivation(
  request: Request,
  admin: ReturnType<typeof supabaseAdminClient>,
  account: User,
  name: string,
  inviter: User,
) {
  const link = await issueInvite(admin, account, new URL(request.url).origin);
  const sent = await sendInviteEmail({
    to: account.email!,
    name,
    inviter: String(
      inviter.user_metadata?.name || inviter.email?.split("@")[0] || "Tu equipo",
    ),
    link,
    locale: requestLocale(request),
  });
  return { inviteLink: link, emailSent: sent };
}

/**
 * Invites a team member. The account is created WITHOUT a password and stays
 * unconfirmed: the person gets an activation email, chooses their own
 * password and only then can sign in. The membership is created through
 * pms_command, which re-checks the inviter's rights in the database.
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
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: false,
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
    }
    invariant(account, "INVITE_FAILED", "No se pudo crear la cuenta.", 503);
    const { data: existing } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("user_id", account.id)
      .maybeSingle();
    invariant(
      !existing,
      "DUPLICATE_MEMBER",
      account.email_confirmed_at
        ? "Esa persona ya forma parte del equipo."
        : "Esa persona ya está invitada. Usa «Reenviar correo de activación» en su ficha.",
      409,
    );
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
    if (account.email_confirmed_at)
      // Someone who already had an active account (e.g. another property).
      return NextResponse.json({
        ...result,
        message: "Miembro añadido. Ya puede iniciar sesión con su cuenta de siempre.",
      });
    const activation = await sendActivation(request, admin, account, input.name, user);
    return NextResponse.json({
      ...result,
      ...activation,
      message: activation.emailSent
        ? "Invitación enviada. Le llegará un correo para activar su cuenta y elegir su contraseña."
        : "No se pudo enviar el correo. Copia el enlace de activación y compártelo.",
    });
  } catch (error) {
    return failure(error);
  }
}

/** Resends the activation email to a member who hasn't activated yet. */
export async function PATCH(request: Request) {
  try {
    assertOrigin(request);
    const { client, organizationId, member, user } = await requireCalaAccess();
    const { userId } = z.object({ userId: z.uuid() }).parse(await body(request));
    const admin = supabaseAdminClient();
    const [{ data: actorRole }, { data: grant }, { data: target }] = await Promise.all([
      client.from("roles").select("key").eq("id", member.role_id).maybeSingle(),
      admin
        .from("role_permissions")
        .select("permission_key")
        .eq("role_id", member.role_id)
        .eq("permission_key", "team.manage")
        .maybeSingle(),
      admin
        .from("organization_members")
        .select("role_id, roles(key)")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    invariant(grant, "FORBIDDEN", "No tienes permiso para gestionar el equipo.", 403);
    invariant(target, "NOT_FOUND", "Esa persona ya no está en el equipo.", 404);
    const targetRole = (target.roles as unknown as { key: string } | null)?.key;
    invariant(
      actorRole &&
        targetRole &&
        canManageRole(actorRole.key as Role, targetRole as Role),
      "ROLE_ESCALATION",
      "No puedes gestionar a esta persona.",
      403,
    );
    const { data, error } = await admin.auth.admin.getUserById(userId);
    invariant(!error && data.user, "NOT_FOUND", "No se encontró la cuenta.", 404);
    invariant(
      !data.user.email_confirmed_at,
      "ALREADY_ACTIVE",
      "Esta persona ya activó su cuenta.",
      409,
    );
    const activation = await sendActivation(
      request,
      admin,
      data.user,
      String(data.user.user_metadata?.name || data.user.email?.split("@")[0]),
      user,
    );
    return NextResponse.json({
      ...activation,
      message: activation.emailSent
        ? "Le reenviamos el correo de activación."
        : "No se pudo enviar el correo. Copia el enlace de activación y compártelo.",
    });
  } catch (error) {
    return failure(error);
  }
}

/**
 * Removes a member AND deletes their Auth account: to come back they must be
 * invited again and choose a new password. pms_command does the removal and
 * re-checks the actor's rights (no self-removal, owners can't be removed).
 * History survives: authored rows keep the author's id (migration
 * 20261121000000_member_account_deletion).
 */
export async function DELETE(request: Request) {
  try {
    assertOrigin(request);
    const { client, organizationId } = await requireCalaAccess();
    const rawId = new URL(request.url).searchParams.get("id") ?? "";
    const target = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    invariant(
      z.uuid().safeParse(target).success,
      "VALIDATION",
      "Falta indicar a quién retirar.",
      400,
    );
    const result = await new SupabaseCommandGateway(client).execute(
      { type: "team.remove", organizationId, id: rawId },
      request.headers.get("Idempotency-Key") || crypto.randomUUID(),
    );
    const admin = supabaseAdminClient();
    // Only delete the account when it no longer belongs to any organization.
    const { count, error: countError } = await admin
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", target);
    if (countError || count) {
      return NextResponse.json({
        ...result,
        message: "Miembro retirado del equipo.",
        ...(countError
          ? { warning: "Miembro retirado, pero no se pudo borrar su cuenta." }
          : {}),
      });
    }
    const { error } = await admin.auth.admin.deleteUser(target);
    if (error && !/not.?found/i.test(error.message)) {
      console.error("[CALA team] deleteUser failed:", error.message);
      return NextResponse.json({
        ...result,
        message: "Miembro retirado del equipo.",
        warning: "Miembro retirado, pero no se pudo borrar su cuenta.",
      });
    }
    return NextResponse.json({
      ...result,
      message: "Miembro retirado y cuenta eliminada.",
    });
  } catch (error) {
    return failure(error);
  }
}

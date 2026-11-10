import { NextResponse } from "next/server";
import { z } from "zod";
import { body, failure } from "@/cala/infrastructure/http/server";
import { assertOrigin } from "@/cala/lib/runtime";
import { requireCalaAccess } from "@/lib/cala/access";
import { supabaseServerClient } from "@/cala/infrastructure/supabase/server";
import { supabaseAdminClient } from "@/cala/infrastructure/supabase/admin";
import { SupabaseAuthAdapter } from "@/cala/infrastructure/supabase/auth";
import { DomainError, invariant } from "@/cala/domain/shared/errors";
import {
  checkCode,
  confirmEmail,
  findUserByEmail,
  issueCode,
} from "@/lib/cala/signup-verification";

/** Language for the confirmation email: the CALA interface cookie. */
function requestLocale(request: Request): "es" | "en" {
  return /(?:^|;\s*)cala-locale=en(?:;|$)/.test(
    request.headers.get("cookie") ?? "",
  )
    ? "en"
    : "es";
}

/** Self sign-up only bootstraps an empty organization (its first owner).
 *  Once anyone belongs to it, new people join by invitation from Equipo;
 *  otherwise any visitor could make themselves owner of the property. */
async function assertSignupOpen(
  admin: ReturnType<typeof supabaseAdminClient>,
  organizationId: string,
) {
  const { count, error } = await admin
    .from("organization_members")
    .select("user_id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  invariant(
    !error,
    "SIGNUP_FAILED",
    "No se pudo verificar el registro. Intenta de nuevo.",
    503,
  );
  invariant(
    !count,
    "SIGNUP_CLOSED",
    "El registro está cerrado. Pide a tu equipo que te invite desde Equipo y permisos.",
    403,
  );
}
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { user } = await requireCalaAccess();
    return NextResponse.json({
      authenticated: true,
      hasOrganization: true,
      assistantCompleted: true,
      user: {
        id: user.id,
        email: user.email,
        name: String(
          user.user_metadata.name || user.email?.split("@")[0] || "Anfitrión",
        ),
      },
    });
  } catch (error) {
    if (error instanceof DomainError && error.status === 401)
      return NextResponse.json({ authenticated: false });
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const input = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("logout") }),
        z.object({ action: z.literal("assistant_complete") }),
        z.object({ action: z.literal("stepup") }),
        z.object({
          action: z.literal("signin"),
          email: z.email().max(255),
          password: z.string().min(1).max(256),
        }),
        z.object({
          action: z.literal("signup"),
          email: z.email().max(255),
          password: z.string().min(8).max(256),
          name: z.string().min(1).max(120).optional(),
        }),
        z.object({
          action: z.literal("signup_verify"),
          email: z.email().max(255),
          password: z.string().min(8).max(256),
          code: z.string().regex(/^\d{6}$/),
        }),
        z.object({
          action: z.literal("signup_resend"),
          email: z.email().max(255),
        }),
      ])
      .parse(await body(request));
    const client = await supabaseServerClient();
    if (input.action === "logout") {
      const { error } = await client.auth.signOut();
      invariant(!error, "SIGN_OUT_FAILED", "No se pudo cerrar sesión.", 503);
      return NextResponse.json({ authenticated: false });
    }
    if (input.action === "assistant_complete") {
      await requireCalaAccess(client);
      const { error } = await client.auth.updateUser({
        data: { cala_assistant_completed: true },
      });
      invariant(
        !error,
        "PROFILE_UPDATE_FAILED",
        "No se pudo guardar tu avance.",
        503,
      );
      return NextResponse.json({
        authenticated: true,
        assistantCompleted: true,
      });
    }
    if (input.action === "stepup") {
      await requireCalaAccess(client);
      await new SupabaseAuthAdapter(client).requireMfa();
      return NextResponse.json({ authenticated: true });
    }
    if (input.action === "signup") {
      // Step 1: create the account unconfirmed (no access yet) and email a
      // 6-digit code through Resend.
      const admin = supabaseAdminClient();
      const organizationId = process.env.CALA_ORGANIZATION_ID!;
      await assertSignupOpen(admin, organizationId);
      const email = input.email.toLowerCase();
      const name = input.name ?? email.split("@")[0];
      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password: input.password,
          email_confirm: false,
          user_metadata: { name },
        });
      let user = created?.user ?? null;
      if (createError) {
        invariant(
          /already|registered|exists/i.test(createError.message),
          "SIGNUP_FAILED",
          "No se pudo crear la cuenta. Intenta de nuevo.",
          503,
        );
        // Same email again: allowed only while it was never confirmed (an
        // abandoned registration). Confirmed accounts must sign in instead.
        user = await findUserByEmail(admin, email);
        invariant(
          user && !user.email_confirmed_at,
          "ACCOUNT_EXISTS",
          "Ya existe una cuenta con ese correo.",
          409,
        );
        const { data: updated, error: updateError } =
          await admin.auth.admin.updateUserById(user!.id, {
            password: input.password,
            user_metadata: { ...user!.user_metadata, name },
          });
        invariant(
          !updateError && updated.user,
          "SIGNUP_FAILED",
          "No se pudo crear la cuenta. Intenta de nuevo.",
          503,
        );
        user = updated.user;
      }
      invariant(
        user,
        "SIGNUP_FAILED",
        "No se pudo crear la cuenta. Intenta de nuevo.",
        503,
      );
      await issueCode(admin, user!, requestLocale(request));
      return NextResponse.json({
        authenticated: false,
        verification: "pending",
        email,
      });
    }

    if (input.action === "signup_resend") {
      const admin = supabaseAdminClient();
      await assertSignupOpen(admin, process.env.CALA_ORGANIZATION_ID!);
      const user = await findUserByEmail(admin, input.email);
      // Same answer whether or not the email exists (no account probing).
      if (user && !user.email_confirmed_at)
        await issueCode(admin, user, requestLocale(request));
      return NextResponse.json({ authenticated: false, verification: "pending" });
    }

    if (input.action === "signup_verify") {
      // Step 2: check the code, confirm the email, then grant ownership.
      const admin = supabaseAdminClient();
      const organizationId = process.env.CALA_ORGANIZATION_ID!;
      const user = await findUserByEmail(admin, input.email);
      invariant(
        user && !user.email_confirmed_at,
        "CODE_MISSING",
        "Solicita un código nuevo para confirmar tu correo.",
        400,
      );
      await checkCode(admin, user!, input.code);
      // Re-check: someone may have completed sign-up in the meantime.
      await assertSignupOpen(admin, organizationId);
      await confirmEmail(admin, user!);

      const { data: role, error: roleError } = await admin
        .from("roles")
        .select("id")
        .eq("key", "owner")
        .is("organization_id", null)
        .maybeSingle();
      invariant(!roleError && role, "SETUP_ERROR", "No se encontró el rol de propietario.", 503);

      const { error: memberError } = await admin
        .from("organization_members")
        .insert({
          organization_id: organizationId,
          user_id: user!.id,
          role_id: role!.id,
          status: "active",
          all_properties: true,
        });
      invariant(
        !memberError,
        "SIGNUP_FAILED",
        "Cuenta creada pero no se pudo asignar acceso. Contacta al administrador.",
        503,
      );

      const { error: signInError } = await client.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      invariant(
        !signInError,
        "SIGNIN_AFTER_SIGNUP_FAILED",
        "Correo confirmado. Inicia sesión con tu contraseña.",
        401,
      );
      return NextResponse.json({ authenticated: true });
    }

    // signin
    const { error } = await client.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    invariant(
      !error,
      "SIGN_IN_FAILED",
      "No se pudo iniciar sesión. Revisa tu correo y contraseña.",
      401,
    );
    try {
      await requireCalaAccess(client);
    } catch (accessError) {
      await client.auth.signOut();
      throw accessError;
    }
    return NextResponse.json({ authenticated: true });
  } catch (error) {
    return failure(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { body, failure } from "@/cala/infrastructure/http/server";
import { assertOrigin } from "@/cala/lib/runtime";
import { requireCalaAccess } from "@/lib/cala/access";
import { supabaseServerClient } from "@/cala/infrastructure/supabase/server";
import { supabaseAdminClient } from "@/cala/infrastructure/supabase/admin";
import { SupabaseAuthAdapter } from "@/cala/infrastructure/supabase/auth";
import { DomainError, invariant } from "@/cala/domain/shared/errors";
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
      const admin = supabaseAdminClient();
      const organizationId = process.env.CALA_ORGANIZATION_ID!;

      // Self sign-up only bootstraps an empty organization (its first owner).
      // Once anyone belongs to it, new people join by invitation from Equipo;
      // otherwise any visitor could make themselves owner of the property.
      const { count, error: countError } = await admin
        .from("organization_members")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", organizationId);
      invariant(
        !countError,
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

      // 1. Create the user via admin (skips email confirmation).
      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: true,
          user_metadata: { name: input.name ?? input.email.split("@")[0] },
        });
      invariant(
        !createError && created.user,
        "SIGNUP_FAILED",
        createError?.message?.includes("already registered")
          ? "Ya existe una cuenta con ese correo."
          : "No se pudo crear la cuenta. Intenta de nuevo.",
        createError?.message?.includes("already registered") ? 409 : 503,
      );

      // 2. Resolve the 'owner' role for this organization (system role has null org).
      const { data: role, error: roleError } = await admin
        .from("roles")
        .select("id")
        .eq("key", "owner")
        .is("organization_id", null)
        .maybeSingle();
      invariant(!roleError && role, "SETUP_ERROR", "No se encontró el rol de propietario.", 503);

      // 3. Add user to organization_members as owner.
      const { error: memberError } = await admin
        .from("organization_members")
        .insert({
          organization_id: organizationId,
          user_id: created.user!.id,
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

      // 4. Sign in the new user so the session cookie is set.
      const { error: signInError } = await client.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      invariant(
        !signInError,
        "SIGNIN_AFTER_SIGNUP_FAILED",
        "Cuenta creada. Inicia sesión manualmente.",
        200,
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

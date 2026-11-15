import prisma from "@/lib/prisma";
import { requireCalaAccess } from "@/lib/cala/access";
import type { supabaseServerClient } from "@/cala/infrastructure/supabase/server";
/** Supabase is the only admin identity provider. Legacy admin_session JWTs are ignored. */
export async function getSession(
  existingClient?: Awaited<ReturnType<typeof supabaseServerClient>>,
) {
  try {
    const {
      client,
      user: identity,
      member,
    } = await requireCalaAccess(existingClient);
    const { data: role } = await client
      .from("roles")
      .select("key")
      .eq("id", member.role_id)
      .single();
    if (
      !member.all_properties ||
      !role ||
      !["owner", "admin", "manager"].includes(role.key)
    )
      return null;
    // Parameterized lookup through the private server connection; site is not exposed via PostgREST.
    let rows = await prisma.$queryRaw<
      Array<{ id: number; email: string; name: string | null; role: string }>
    >`SELECT id, email, name, role FROM site."AdminUser" WHERE supabase_user_id=${identity.id}::uuid AND role IN ('ADMIN','SUPERADMIN')`;
    if (!rows[0] && identity.email) {
      // CALA membership is the source of truth: an owner/admin/manager added
      // from Equipo gets the website-admin profile on first use. Supabase
      // emails are unique, so an older row with the same email is relinked.
      const name = String(identity.user_metadata?.name || "").trim() || null;
      const adminRole = role.key === "owner" ? "SUPERADMIN" : "ADMIN";
      rows = await prisma.$queryRaw<
        Array<{ id: number; email: string; name: string | null; role: string }>
      >`INSERT INTO site."AdminUser"(email,name,"passwordHash",role,supabase_user_id,"updatedAt")
        VALUES (${identity.email.toLowerCase()},${name},'SUPABASE_AUTH_ONLY',${adminRole},${identity.id}::uuid,now())
        ON CONFLICT (email) DO UPDATE SET supabase_user_id=excluded.supabase_user_id, role=excluded.role, "updatedAt"=now()
        RETURNING id, email, name, role`;
    }
    const user = rows[0];
    if (!user) return null;
    return { user, authUserId: identity.id, version: identity.updated_at || "" };
  } catch {
    return null;
  }
}
export async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireAdminPage() {
  const session = await getSession();
  if (!session) {
    const { redirect } = await import("next/navigation");
    redirect("/admin/login/");
  }
  return session;
}

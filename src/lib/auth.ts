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
    const rows = await prisma.$queryRaw<
      Array<{ id: number; email: string; name: string | null; role: string }>
    >`SELECT id, email, name, role FROM site."AdminUser" WHERE supabase_user_id=${identity.id}::uuid AND role IN ('ADMIN','SUPERADMIN')`;
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

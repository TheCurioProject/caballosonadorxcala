import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { failure } from "@/cala/infrastructure/http/server";
import { supabaseServerClient } from "@/cala/infrastructure/supabase/server";
import { invariant } from "@/cala/domain/shared/errors";
export const dynamic = "force-dynamic";

/**
 * "Did anything change?" for the open CALA panel. The database hashes the
 * workspace (pms_workspace_stamp), so this request is tiny; the browser only
 * downloads the full workspace when the stamp differs. `stamp: null` means the
 * database does not have the function yet: the browser then refreshes slowly.
 */
export async function GET(request: Request) {
  try {
    const organizationId = process.env.CALA_ORGANIZATION_ID ?? "";
    const asked = new URL(request.url).searchParams.get("organizationId");
    invariant(
      organizationId && (!asked || asked === organizationId),
      "FORBIDDEN",
      "Organización no permitida.",
      403,
    );
    const client = (await supabaseServerClient()) as unknown as SupabaseClient;
    const { data, error } = await client.rpc("pms_workspace_stamp", {
      org: organizationId,
    });
    if (error) {
      invariant(
        error.code !== "42501",
        "UNAUTHORIZED",
        "Inicia sesión para continuar.",
        401,
      );
      return NextResponse.json(
        { stamp: null },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.json(
      { stamp: typeof data === "string" ? data : null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

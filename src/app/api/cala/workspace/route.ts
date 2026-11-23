import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { failure } from "@/cala/infrastructure/http/server";
import { supabaseSnapshot } from "@/cala/infrastructure/supabase/snapshot";
import { requireCalaAccess } from "@/lib/cala/access";
import { invariant } from "@/cala/domain/shared/errors";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { client, organizationId, member } = await requireCalaAccess();
    const query = new URL(request.url).searchParams;
    invariant(
      !query.get("organizationId") ||
        query.get("organizationId") === organizationId,
      "FORBIDDEN",
      "Organización no permitida.",
      403,
    );
    // Stamp first: a change made while the snapshot is read makes the next
    // stamp check differ, so it is picked up (never missed).
    const stamp = await (client as unknown as SupabaseClient)
      .rpc("pms_workspace_stamp", { org: organizationId })
      .then(({ data }) => (typeof data === "string" ? data : null));
    const result = await supabaseSnapshot(
      client,
      organizationId,
      query.get("propertyId") ||
        (member.all_properties
          ? process.env.CALA_DEFAULT_PROPERTY_ID
          : undefined),
    );
    return NextResponse.json({ ...result, stamp }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}

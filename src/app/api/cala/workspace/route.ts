import { NextResponse } from "next/server";
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
    const result = await supabaseSnapshot(
      client,
      organizationId,
      query.get("propertyId") ||
        (member.all_properties
          ? process.env.CALA_DEFAULT_PROPERTY_ID
          : undefined),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}

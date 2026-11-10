import { NextResponse } from "next/server";
import { body, failure } from "@/cala/infrastructure/http/server";
import { assertOrigin } from "@/cala/lib/runtime";
import { commandSchema } from "@/cala/application/schemas";
import { SupabaseCommandGateway } from "@/cala/infrastructure/supabase/commands";
import { requireCalaAccess } from "@/lib/cala/access";
import { invariant } from "@/cala/domain/shared/errors";
import { isWebsiteProperty, revalidatePublicSite } from "@/lib/revalidatePublic";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { client, organizationId } = await requireCalaAccess();
    const input = commandSchema.parse(await body(request));
    invariant(
      "organizationId" in input && input.organizationId === organizationId,
      "FORBIDDEN",
      "Operación fuera de este alojamiento.",
      403,
    );
    const result = await new SupabaseCommandGateway(client).execute(
      input,
      request.headers.get("Idempotency-Key") || "",
    );
    // Casa Caballo Soñador's changes (rates, restrictions, inventory, stays,
    // blocks, settings) must show on the public website immediately.
    if ("propertyId" in input && isWebsiteProperty(input.propertyId))
      revalidatePublicSite();
    if (result.secretUrl)
      result.secretUrl = result.secretUrl.replace(
        "/api/ical?",
        "/api/cala/ical?",
      );
    return NextResponse.json(result);
  } catch (error) {
    return failure(error);
  }
}

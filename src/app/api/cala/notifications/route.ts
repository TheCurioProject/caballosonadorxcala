import { NextResponse, after } from "next/server";
import { z } from "zod";
import { body, failure } from "@/cala/infrastructure/http/server";
import { assertOrigin } from "@/cala/lib/runtime";
import { requireCalaAccess } from "@/lib/cala/access";
import { DomainError } from "@/cala/domain/shared/errors";
import { untyped } from "@/lib/cala/connectors/calendar-sync";
import { deliverPushQuietly, pushConfigured, pushPublicKey } from "@/lib/cala/push";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The bell in CALA's top bar. Each person only ever reads their own
 * notifications (the database chose the recipients by role and property).
 */
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), ids: z.array(z.string().uuid()).max(100).optional() }),
  z.object({
    action: z.literal("subscribe"),
    endpoint: z.string().url().startsWith("https://").max(1000),
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(8).max(100),
  }),
  z.object({ action: z.literal("unsubscribe"), endpoint: z.string().max(1000) }),
  z.object({ action: z.literal("test") }),
]);

async function call(client: unknown, organizationId: string, command: Record<string, unknown>) {
  const { data, error } = await untyped(client).rpc("pms_notifications", {
    command: { ...command, organizationId },
  });
  if (error) {
    // Before the migration is applied the bell simply stays empty.
    if (/pms_notifications|function .* does not exist|schema cache/i.test(error.message))
      throw new DomainError("NOTIFICATIONS_NOT_READY", "Las notificaciones aún no están activadas en la base de datos.", 503);
    throw new DomainError("NOTIFICATIONS_FAILED", "No se pudieron cargar las notificaciones.", 502);
  }
  return data as Record<string, unknown>;
}

export async function GET() {
  try {
    const { client, organizationId } = await requireCalaAccess();
    const data = await call(client, organizationId, { action: "list" });
    // Opportunistic delivery: events written by the website or Stripe go out on the next poll.
    after(deliverPushQuietly);
    return NextResponse.json({ ...data, push: { configured: pushConfigured(), publicKey: pushPublicKey() } });
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOTIFICATIONS_NOT_READY")
      return NextResponse.json({ items: [], unread: 0, devices: 0, ready: false, push: { configured: false, publicKey: "" } });
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { client, organizationId } = await requireCalaAccess();
    const command = input.parse(await body(request));
    const data = await call(client, organizationId, {
      ...command,
      ...(command.action === "subscribe" ? { userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null } : {}),
    });
    if (command.action === "test") after(deliverPushQuietly);
    return NextResponse.json(data);
  } catch (error) {
    return failure(error);
  }
}

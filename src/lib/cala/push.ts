import webpush from "web-push";
import { supabaseAdminClient } from "@/cala/infrastructure/supabase/admin";
import { untyped } from "./connectors/calendar-sync";

/**
 * Browser push for the CALA bell. The database writes one notification per
 * recipient (role-filtered); this sends each one once to every device that
 * person enabled, and forgets devices the browser has revoked.
 *
 * Needs VAPID keys (`npx web-push generate-vapid-keys`):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:… or https://…)
 */
export function pushPublicKey() {
  return process.env.VAPID_PUBLIC_KEY?.trim() || "";
}

export function pushConfigured() {
  return Boolean(pushPublicKey() && process.env.VAPID_PRIVATE_KEY?.trim());
}

type Claimed = {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  subscriptions: { endpoint: string; p256dh: string; auth: string }[];
};

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:no-reply@casacaballosonador.com",
    pushPublicKey(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );
  configured = true;
}

/** Sends the pending pushes. Safe to call from several places at once: the database hands each one out once. */
export async function deliverPush(options: { max?: number } = {}) {
  if (!pushConfigured()) return { sent: 0, devices: 0, gone: 0, skipped: "VAPID keys missing" };
  configure();
  const admin = untyped(supabaseAdminClient());
  const { data, error } = await admin.rpc("pms_service_push_claim", { max_items: options.max ?? 50 });
  if (error) throw new Error(`push claim failed: ${error.message}`);
  const items = (data ?? []) as Claimed[];
  const delivered = new Set<string>();
  const gone = new Set<string>();
  await Promise.all(
    items.flatMap((item) =>
      item.subscriptions.map(async (device) => {
        try {
          await webpush.sendNotification(
            { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
            JSON.stringify({ id: item.id, kind: item.kind, title: item.title, body: item.body, url: item.url ?? "/admin/inicio/" }),
            { TTL: 6 * 60 * 60, urgency: item.kind === "payment.review" ? "high" : "normal", timeout: 10000 },
          );
          delivered.add(device.endpoint);
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 404/410: the browser dropped this subscription (permission removed, app uninstalled).
          if (status === 404 || status === 410) gone.add(device.endpoint);
          else console.error("[Push] delivery failed", status, (error as Error).message);
        }
      }),
    ),
  );
  if (delivered.size || gone.size)
    await admin.rpc("pms_service_push_report", { delivered: [...delivered], gone: [...gone] });
  return { sent: items.length, devices: delivered.size, gone: gone.size };
}

/** For route handlers: never lets a push problem affect the response. */
export async function deliverPushQuietly() {
  try {
    await deliverPush();
  } catch (error) {
    console.error("[Push]", error);
  }
}

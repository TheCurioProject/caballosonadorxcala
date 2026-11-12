import { Resend } from "resend";
import { supabaseAdminClient } from "@/cala/infrastructure/supabase/admin";
import { providerForSource } from "@/cala/domain/messaging/ota";
import { untyped } from "./calendar-sync";
import { matchReservation, parseInbound } from "./mail-parse";

/** What the server needs for the e-mail relay; the assistant shows it as checks. */
export function mailSetup() {
  const domain = (process.env.CALA_INBOUND_DOMAIN ?? "").trim().toLowerCase();
  return {
    domain,
    receiving: Boolean(domain),
    webhook: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()),
    sending: Boolean(process.env.RESEND_API_KEY?.trim()),
  };
}
export const mailReady = () => {
  const s = mailSetup();
  return s.receiving && s.webhook && s.sending;
};
export const inboxAddress = (localPart: string) => `${localPart}@${mailSetup().domain}`;

const resend = () => new Resend(process.env.RESEND_API_KEY);

/** Handles one `email.received` event for any CALA relay address. */
export async function receiveEmail(event: { email_id: string; to: string[]; received_for?: string[] }) {
  const { domain } = mailSetup();
  const locals = [...(event.received_for ?? []), ...event.to]
    .map((a) => (/<([^>]+)>/.exec(a)?.[1] ?? a).trim().toLowerCase())
    .filter((a) => a.endsWith("@" + domain))
    .map((a) => a.split("@")[0].split("+")[0]);
  const admin = untyped(supabaseAdminClient());
  const results = [];
  for (const localPart of [...new Set(locals)]) {
    const { data: owner } = await admin.rpc("pms_service_inbox_owner", { local: localPart });
    if (!owner) continue;
    const { data: email, error } = await resend().emails.receiving.get(event.email_id);
    if (error || !email) throw new Error("received e-mail unavailable");
    const parsed = parseInbound({
      from: email.from,
      subject: email.subject,
      text: email.text,
      html: email.html,
      replyTo: email.reply_to,
      headers: email.headers,
    });
    const reservationId =
      parsed.kind === "message"
        ? matchReservation(parsed, owner.reservations ?? [], providerForSource)
        : null;
    const { data } = await admin.rpc("pms_service_inbound", {
      payload: {
        localPart,
        resendId: event.email_id,
        kind: parsed.kind,
        provider: parsed.provider,
        replyTo: parsed.replyTo,
        guestName: parsed.guestName,
        externalCode: parsed.externalCode,
        reservationId,
        subject: parsed.subject,
        body: parsed.body,
        summary: parsed.summary,
        from: email.from,
      },
    });
    results.push(data);
  }
  return results;
}

/** Sends queued replies to the OTA relay addresses. */
export async function deliverOutbox(max = 20) {
  if (!mailReady()) return { sent: 0, failed: 0, skipped: true };
  const admin = untyped(supabaseAdminClient());
  const { data, error } = await admin.rpc("pms_service_outbox_claim", { max_items: max });
  if (error) throw new Error("outbox unavailable");
  let sent = 0,
    failed = 0;
  for (const m of (data ?? []) as {
    id: string;
    subject: string | null;
    body: string;
    replyTo: string | null;
    propertyName: string;
    localPart: string;
  }[]) {
    if (!m.replyTo) {
      await admin.rpc("pms_service_outbox_done", { message: m.id, ok: false, failure: "Esta conversación no tiene dirección de respuesta.", external: null });
      failed++;
      continue;
    }
    const inbox = inboxAddress(m.localPart);
    const fromInbox = !mailSetup().domain.endsWith(".resend.app");
    const fallback = process.env.CALA_EMAIL_FROM || "no-reply@casacaballosonador.com";
    const name = m.propertyName.replace(/["<>]/g, "");
    const { data: result, error: sendError } = await resend().emails.send(
      {
        from: `${name} <${fromInbox ? inbox : fallback}>`,
        to: [m.replyTo],
        replyTo: inbox,
        subject: m.subject || `Re: ${name}`,
        text: m.body,
      },
      { idempotencyKey: `cala-ota-${m.id}` },
    );
    await admin.rpc("pms_service_outbox_done", {
      message: m.id,
      ok: !sendError,
      failure: sendError ? `No se pudo enviar: ${sendError.message}` : null,
      external: result?.id ?? null,
    });
    if (sendError) failed++;
    else sent++;
  }
  return { sent, failed };
}

export async function markBounced(emailId: string, reason: string) {
  await untyped(supabaseAdminClient()).rpc("pms_service_message_bounced", {
    external: emailId,
    reason: `El canal rechazó la respuesta: ${reason}`.slice(0, 500),
  });
}

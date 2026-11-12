import { Resend } from "resend";
import { supabaseAdminClient } from "@/cala/infrastructure/supabase/admin";
import { providerForSource } from "@/cala/domain/messaging/ota";
import { DomainError } from "@/cala/domain/shared/errors";
import { untyped } from "./calendar-sync";
import { matchReservation, parseInbound } from "./mail-parse";

type MailSettings = { domain?: string | null; webhookId?: string | null; webhookSecret?: string | null };

const resend = () => new Resend(process.env.RESEND_API_KEY);
const admin = () => untyped(supabaseAdminClient());

async function storedSettings(): Promise<MailSettings> {
  const { data } = await admin().rpc("pms_service_mail_settings");
  return (data ?? {}) as MailSettings;
}

/**
 * The relay only needs RESEND_API_KEY (already used for sign-up codes). The
 * receiving domain and the webhook secret are saved by the assistant in the
 * database; env vars still override them if present.
 */
export async function mailSetup() {
  const saved = await storedSettings().catch(() => ({}) as MailSettings);
  const domain = (process.env.CALA_INBOUND_DOMAIN || saved.domain || "").trim().toLowerCase();
  const secret = (process.env.RESEND_WEBHOOK_SECRET || saved.webhookSecret || "").trim();
  return {
    apiKey: Boolean(process.env.RESEND_API_KEY?.trim()),
    domain,
    secret,
    receiving: Boolean(domain),
    webhook: Boolean(secret),
  };
}
export async function mailReady() {
  const s = await mailSetup();
  return s.apiKey && s.receiving && s.webhook;
}

/** Domains of the Resend account that can receive e-mail (custom MX domains). */
export async function receivingDomains() {
  const { data, error } = await resend().domains.list();
  if (error) throw keyError(error.message);
  return (data?.data ?? [])
    .filter((d) => d.capabilities?.receiving === "enabled")
    .map((d) => d.name.toLowerCase());
}

function keyError(message: string) {
  return new DomainError(
    "RESEND_KEY",
    /restricted|permission|not allowed|sending access/i.test(message)
      ? "La clave de Resend solo permite enviar. En Resend → API Keys crea una con «Full access» y ponla en RESEND_API_KEY."
      : "Resend no aceptó la clave (RESEND_API_KEY). Revísala en Resend → API Keys.",
    422,
  );
}

/**
 * One-click setup: saves the receiving domain and creates (or recreates) the
 * webhook that points to this site, keeping its signing secret.
 */
export async function configureMail(rawDomain: string, endpoint: string) {
  if (!process.env.RESEND_API_KEY?.trim())
    throw new DomainError("RESEND_KEY", "Falta RESEND_API_KEY en Vercel.", 422);
  const domain = rawDomain.trim().toLowerCase().replace(/^.*@/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain))
    throw new DomainError("INVALID_DOMAIN", "Pega la dirección de recepción de Resend, por ejemplo algo@abcd1234.resend.app.", 422);
  if (!domain.endsWith(".resend.app")) {
    const domains = await receivingDomains();
    if (!domains.includes(domain))
      throw new DomainError(
        "DOMAIN_NOT_RECEIVING",
        `«${domain}» no tiene la recepción activada en Resend. Usa tu dirección .resend.app o activa Receiving en ese dominio.`,
        422,
      );
  }
  const r = resend();
  const { data: hooks, error: listError } = await r.webhooks.list();
  if (listError) throw keyError(listError.message);
  for (const hook of hooks?.data ?? [])
    if ((hook as { endpoint?: string }).endpoint === endpoint) await r.webhooks.remove(hook.id);
  const { data: created, error } = await r.webhooks.create({
    endpoint,
    events: ["email.received"],
  });
  if (error || !created) throw keyError(error?.message ?? "");
  const { error: saveError } = await admin().rpc("pms_service_mail_settings_save", {
    new_domain: domain,
    new_webhook: created.id,
    new_secret: created.signing_secret,
  });
  if (saveError) throw new DomainError("SAVE_FAILED", "No se pudo guardar la configuración. Inténtalo de nuevo.", 503);
  return { domain };
}

export const inboxAddress = (localPart: string, domain: string) => `${localPart}@${domain}`;

/** Handles one `email.received` event for any CALA relay address. */
export async function receiveEmail(event: { email_id: string; to: string[]; received_for?: string[] }) {
  const { domain } = await mailSetup();
  const locals = [...(event.received_for ?? []), ...event.to]
    .map((a) => (/<([^>]+)>/.exec(a)?.[1] ?? a).trim().toLowerCase())
    .filter((a) => a.endsWith("@" + domain))
    .map((a) => a.split("@")[0].split("+")[0]);
  const db = admin();
  const results = [];
  for (const localPart of [...new Set(locals)]) {
    const { data: owner } = await db.rpc("pms_service_inbox_owner", { local: localPart });
    if (!owner) continue;
    // Fetching it from Resend also proves the event refers to a real e-mail of this account.
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
      parsed.kind === "message" ? matchReservation(parsed, owner.reservations ?? [], providerForSource) : null;
    const { data } = await db.rpc("pms_service_inbound", {
      payload: {
        localPart,
        resendId: event.email_id,
        kind: parsed.kind,
        provider: parsed.provider,
        replyTo: parsed.replyTo,
        guestName: parsed.guestName,
        externalCode: parsed.externalCode,
        externalUrl: parsed.threadUrl,
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

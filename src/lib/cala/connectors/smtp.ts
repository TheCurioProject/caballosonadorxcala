import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { supabaseAdminClient } from "@/cala/infrastructure/supabase/admin";
import { DomainError } from "@/cala/domain/shared/errors";
import { untyped } from "./calendar-sync";
import { smtpPreset, type SmtpPreset } from "./smtp-presets";

/**
 * Replies to OTA guests leave from the host's own mailbox: Airbnb, Booking.com,
 * Vrbo and Expedia only pass a relay reply into their chat when it comes from
 * the address registered in the account. CALA logs into that mailbox's SMTP
 * server with an app password.
 */
export { smtpPreset };

// ---- secret at rest --------------------------------------------------------
// AES-256-GCM with a key derived from the service-role key (already a server
// secret): no new environment variable. Rotating that key only means pasting
// the app password again.
function key() {
  const base = process.env.CALA_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new DomainError("SUPABASE_NOT_CONFIGURED", "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.", 503);
  return createHash("sha256").update(`cala-smtp:${base}`).digest();
}
export function sealSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}
export function openSecret(sealed: string) {
  const [v, iv, tag, data] = sealed.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("bad secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

// ---- SMTP ------------------------------------------------------------------
export type SenderConfig = { email: string; host: string; port: number; username: string; password: string };

function transport(c: SenderConfig) {
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.port === 465,
    requireTLS: c.port !== 465,
    auth: { user: c.username, pass: c.password },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

/** Turns SMTP failures into something the host can act on. */
export function smtpFailure(error: unknown, preset: SmtpPreset | null = null) {
  const e = error as { code?: string; responseCode?: number; response?: string; message?: string };
  const text = `${e?.response ?? ""} ${e?.message ?? ""}`;
  if (/5\.7\.9|application-specific password required/i.test(text))
    return "Google pide una contraseña de aplicación, no tu contraseña normal. Créala en tu cuenta de Google → Seguridad → Contraseñas de aplicaciones.";
  if (e?.code === "EAUTH" || e?.responseCode === 535 || /5\.7\.8|username and password not accepted|authentication failed|invalid credentials/i.test(text))
    return preset?.provider === "google"
      ? "Google no aceptó el correo o la contraseña de aplicación. Revisa que la contraseña sea la de 16 letras que te dio Google (sin espacios) y que la verificación en dos pasos siga activa."
      : "El servidor no aceptó el usuario o la contraseña. Revisa que sea una contraseña de aplicación.";
  if (/5\.7\.0.*(disabled|not allowed)|smtp.*disabled|access denied/i.test(text))
    return "Tu proveedor no permite enviar por SMTP con esta cuenta. Pide que lo activen o usa otro correo registrado en las OTAs.";
  if (["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ECONNREFUSED", "ENOTFOUND", "EDNS"].includes(e?.code ?? ""))
    return "No se pudo conectar con el servidor de correo. Revisa el servidor y el puerto e inténtalo de nuevo.";
  if (/5\.1\.1|5\.1\.0|recipient|user unknown|no such user|mailbox unavailable/i.test(text))
    return "La OTA no aceptó la dirección de respuesta de esta conversación.";
  return `El servidor de correo respondió: ${(e?.response || e?.message || "error desconocido").slice(0, 200)}`;
}

/**
 * Proves the mailbox works before saving it: logs in and sends a short note
 * to the same address (the host sees it in their inbox).
 */
export async function proveSender(c: SenderConfig, propertyName: string) {
  const t = transport(c);
  try {
    await t.verify();
    await t.sendMail({
      from: { name: `CALA · ${propertyName}`, address: c.email },
      to: c.email,
      subject: "CALA ya puede responder a tus huéspedes desde este correo",
      text: `Este es un correo automático de CALA.\n\nA partir de ahora, cuando respondas a un huésped de Airbnb, Booking.com, Vrbo o Expedia desde la bandeja de Mensajes de CALA, la respuesta saldrá desde ${c.email}, como si la escribieras aquí. Las verás también en tu carpeta de Enviados.\n\nSi no fuiste tú, entra a tu cuenta de Google → Seguridad → Contraseñas de aplicaciones y borra la de CALA.`,
    });
  } catch (error) {
    throw new DomainError("SMTP_REJECTED", smtpFailure(error, smtpPreset(c.email)), 422);
  } finally {
    t.close();
  }
}

const admin = () => untyped(supabaseAdminClient());

type Claimed = {
  id: string;
  propertyId: string;
  subject: string | null;
  body: string;
  replyTo: string | null;
  propertyName: string;
  /** Message-ID of the latest OTA notice of the thread (and earlier ones). */
  inReplyTo?: string | null;
  references?: string[] | null;
};

/** "<id@host>" — Resend may give Message-IDs with or without brackets. */
export function messageIdHeader(value: string | null | undefined) {
  const v = (value ?? "").trim().replace(/^<|>$/g, "");
  return /^[^\s<>@]+@[^\s<>@]+$/.test(v) ? `<${v}>` : null;
}
type StoredSender = { email: string; host: string; port: number; username: string; secret: string; verifiedAt: string };

export async function storedSender(propertyId: string) {
  const { data, error } = await admin().rpc("pms_service_mail_sender", { prop: propertyId });
  if (error) throw new Error("sender unavailable");
  return (data ?? null) as StoredSender | null;
}

/** The mailbox the OTAs write to (To of the latest guest notice), if known. */
export async function otaRecipient(propertyId: string) {
  const { data, error } = await admin().rpc("pms_service_ota_recipient", { prop: propertyId });
  return error || typeof data !== "string" ? null : data.toLowerCase();
}

/**
 * Sends queued replies (one message right after the host presses «Enviar»,
 * or the whole queue from the cron as a safety net).
 */
export async function deliverReplies(options: { only?: string; max?: number } = {}) {
  const db = admin();
  const { data, error } = await db.rpc("pms_service_outbox_claim_sender", {
    max_items: options.max ?? 20,
    only_message: options.only ?? null,
  });
  if (error) throw new Error("outbox unavailable");
  const claimed = (data ?? []) as Claimed[];
  const senders = new Map<string, { config: SenderConfig; t: ReturnType<typeof transport> } | null>();
  const done = (id: string, ok: boolean, failure: string | null, external: string | null) =>
    db.rpc("pms_service_outbox_done", { message: id, ok, failure, external });
  let sent = 0,
    failed = 0;
  const failures: Record<string, string> = {};
  for (const m of claimed) {
    if (!senders.has(m.propertyId)) {
      const s = await storedSender(m.propertyId).catch(() => null);
      let config: SenderConfig | null = null;
      try {
        if (s) config = { email: s.email, host: s.host, port: s.port, username: s.username, password: openSecret(s.secret) };
      } catch {
        config = null;
      }
      senders.set(m.propertyId, config ? { config, t: transport(config) } : null);
    }
    const sender = senders.get(m.propertyId);
    const fail = async (reason: string) => {
      await done(m.id, false, reason, null);
      failures[m.id] = reason;
      failed++;
    };
    if (!sender) {
      await fail("CALA no pudo abrir tu correo de envío. Vuelve a conectarlo en el asistente de mensajes (paso «Responder»).");
      continue;
    }
    if (!m.replyTo) {
      await fail("Esta conversación aún no tiene dirección de respuesta de la OTA.");
      continue;
    }
    try {
      // Sent as a normal reply to the OTA notice: same subject, In-Reply-To and
      // References, so the relay and the host's mailbox thread it correctly.
      const inReplyTo = messageIdHeader(m.inReplyTo);
      const references = (m.references ?? []).map(messageIdHeader).filter((x): x is string => Boolean(x));
      const info = await sender.t.sendMail({
        from: { name: m.propertyName.replace(/["<>]/g, ""), address: sender.config.email },
        to: m.replyTo,
        subject: m.subject || `Re: ${m.propertyName}`,
        text: m.body,
        ...(inReplyTo ? { inReplyTo, references: references.length ? references : [inReplyTo] } : {}),
        headers: { "X-CALA-Message": m.id },
      });
      if (info.rejected?.length) await fail(smtpFailure({ response: String(info.response ?? "recipient rejected") }));
      else {
        await done(m.id, true, null, String(info.messageId ?? "").slice(0, 300) || null);
        sent++;
      }
    } catch (e) {
      await fail(smtpFailure(e, smtpPreset(sender.config.email)));
    }
  }
  for (const s of senders.values()) s?.t.close();
  return { sent, failed, failures };
}

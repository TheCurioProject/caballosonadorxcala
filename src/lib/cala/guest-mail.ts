import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { supabaseAdminClient } from "@/cala/infrastructure/supabase/admin";
import { DomainError } from "@/cala/domain/shared/errors";
import {
  buildGuestEmail,
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  type EmailButton,
} from "@/cala/domain/messaging/guest-email";
import { messageValues, type MessageValues } from "@/cala/domain/messaging/templates";
import { untyped } from "./connectors/calendar-sync";

/**
 * Scheduled guest e-mails (Plantillas de mensajes): rendering, documents kept
 * in a private Supabase Storage bucket, and delivery through Resend. The
 * database decides what is due and logs each send once (guest_mail_deliveries).
 */
export const DOCUMENT_BUCKET = "cala-documents";

const admin = () => untyped(supabaseAdminClient());

export type GuestMailDocument = {
  id: string;
  name: string;
  fileName: string;
  contentType: string;
  storagePath: string;
  size: number;
};
export type GuestMailPayload = {
  id: string;
  kind: "auto" | "manual";
  recipient: string;
  propertyId: string;
  template: {
    id: string;
    name: string;
    locale: string;
    subject: string;
    body: string;
    buttons: EmailButton[];
    documents: GuestMailDocument[];
  };
  reservation: {
    arrival: string;
    departure: string;
    confirmationCode: string;
    adults: number;
    children: number;
  };
  guest: { firstName: string; lastName: string };
  property: { name: string; timezone: string; checkIn: string; checkOut: string };
  unitName: string | null;
};

// ---- documents --------------------------------------------------------------

async function ensureBucket() {
  const storage = supabaseAdminClient().storage;
  const { error } = await storage.getBucket(DOCUMENT_BUCKET);
  if (!error) return;
  const { error: createError } = await storage.createBucket(DOCUMENT_BUCKET, {
    public: false,
    fileSizeLimit: MAX_DOCUMENT_BYTES,
    allowedMimeTypes: Object.keys(DOCUMENT_TYPES),
  });
  if (createError && !/exist/i.test(createError.message))
    throw new DomainError("STORAGE_UNAVAILABLE", "No se pudo preparar el almacenamiento de documentos.", 503);
}

export function safeFileName(name: string) {
  const clean = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return (clean || "documento").slice(-120);
}

/** The browser uploads the file straight to Storage (Vercel caps request bodies at 4.5 MB). */
export async function documentUploadUrl(organizationId: string, propertyId: string, fileName: string) {
  await ensureBucket();
  const path = `${organizationId}/${propertyId}/${randomUUID()}/${safeFileName(fileName)}`;
  const { data, error } = await supabaseAdminClient().storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new DomainError("STORAGE_UNAVAILABLE", "No se pudo preparar la subida. Inténtalo de nuevo.", 503);
  return { path, signedUrl: data.signedUrl };
}

/** Size and type as stored (never trusted from the browser). */
export async function documentInfo(path: string) {
  const { data, error } = await supabaseAdminClient().storage.from(DOCUMENT_BUCKET).info(path);
  if (error || !data)
    throw new DomainError("UPLOAD_MISSING", "El archivo no terminó de subirse. Vuelve a intentarlo.", 409);
  const info = data as { size?: number; contentType?: string; metadata?: { size?: number; mimetype?: string } };
  return {
    size: Number(info.size ?? info.metadata?.size ?? 0),
    contentType: String(info.contentType ?? info.metadata?.mimetype ?? "application/octet-stream"),
  };
}

export async function removeDocumentFile(path: string) {
  await supabaseAdminClient().storage.from(DOCUMENT_BUCKET).remove([path]);
}

export async function documentLink(path: string, fileName: string) {
  const { data, error } = await supabaseAdminClient()
    .storage.from(DOCUMENT_BUCKET)
    .createSignedUrl(path, 120, { download: fileName });
  if (error || !data) throw new DomainError("NOT_FOUND", "No se encontró el archivo.", 404);
  return data.signedUrl;
}

async function documentBytes(path: string) {
  const { data, error } = await supabaseAdminClient().storage.from(DOCUMENT_BUCKET).download(path);
  if (error || !data) throw new Error(`No se pudo leer el documento ${path.split("/").pop()}.`);
  return Buffer.from(await data.arrayBuffer());
}

// ---- sending ----------------------------------------------------------------

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** "Casa Caballo Soñador" <no-reply@…>: the guest sees the property's name. */
export function guestFrom(propertyName: string) {
  const configured = process.env.CALA_GUEST_EMAIL_FROM || process.env.CALA_EMAIL_FROM || "";
  const address = configured.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] ?? (/^[^\s<>]+@[^\s<>]+$/.test(configured.trim()) ? configured.trim() : "no-reply@casacaballosonador.com");
  const name = propertyName.replace(/["<>\r\n]/g, "").trim() || "CALA";
  return `"${name}" <${address}>`;
}

/** Where guest replies go: the host's connected mailbox, else a configured address. */
export async function guestReplyTo(propertyId: string) {
  const { data } = await admin().rpc("pms_service_guest_mail_reply_to", { prop: propertyId });
  const fromDb = typeof data === "string" && data.includes("@") ? data : null;
  return fromDb || process.env.CALA_GUEST_REPLY_TO?.trim() || process.env.BOOKING_ADMIN_EMAIL?.trim() || null;
}

export function payloadValues(p: GuestMailPayload): MessageValues {
  return messageValues(
    {
      guest: p.guest,
      propertyName: p.property.name,
      checkIn: p.property.checkIn,
      checkOut: p.property.checkOut,
      arrival: p.reservation.arrival,
      departure: p.reservation.departure,
      confirmationCode: p.reservation.confirmationCode,
      unitName: p.unitName,
      adults: p.reservation.adults,
      children: p.reservation.children,
    },
    p.template.locale,
  );
}

type Files = Map<string, Buffer>;

/** Renders and sends one e-mail. Throws a readable message on failure. */
export async function sendGuestEmail(
  input: {
    to: string;
    propertyId: string;
    propertyName: string;
    locale: string;
    subject: string;
    body: string;
    buttons: EmailButton[];
    documents: GuestMailDocument[];
    values: MessageValues;
    idempotencyKey?: string;
    subjectPrefix?: string;
  },
  files: Files = new Map(),
) {
  if (!mailConfigured()) throw new Error("Falta RESEND_API_KEY en el servidor: no se puede enviar correo.");
  const email = buildGuestEmail({
    subject: input.subject,
    body: input.body,
    buttons: input.buttons,
    attachments: input.documents,
    propertyName: input.propertyName,
    locale: input.locale,
    values: input.values,
  });
  const attachments = [];
  for (const d of input.documents) {
    if (!files.has(d.storagePath)) files.set(d.storagePath, await documentBytes(d.storagePath));
    attachments.push({ filename: d.fileName, content: files.get(d.storagePath)!, contentType: d.contentType });
  }
  const replyTo = await guestReplyTo(input.propertyId).catch(() => null);
  const subject = `${input.subjectPrefix ?? ""}${email.subject}`.slice(0, 300);
  const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send(
    {
      from: guestFrom(input.propertyName),
      to: [input.to],
      subject,
      html: email.html,
      text: email.text,
      ...(replyTo ? { replyTo } : {}),
      ...(attachments.length ? { attachments } : {}),
    },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
  );
  if (error) throw new Error(`El servicio de correo rechazó el envío: ${error.message}`.slice(0, 480));
  return { id: data?.id ?? null, subject };
}

async function finish(id: string, ok: boolean, failure: string | null, providerId: string | null, subject: string | null) {
  await admin().rpc("pms_service_guest_mail_done", {
    delivery: id,
    ok,
    error_text: failure,
    provider_ref: providerId,
    rendered_subject: subject,
  });
}

/** Sends one claimed delivery and records the outcome. */
export async function deliverPayload(p: GuestMailPayload, files: Files = new Map()) {
  try {
    const sent = await sendGuestEmail(
      {
        to: p.recipient,
        propertyId: p.propertyId,
        propertyName: p.property.name,
        locale: p.template.locale,
        subject: p.template.subject,
        body: p.template.body,
        buttons: p.template.buttons ?? [],
        documents: p.template.documents ?? [],
        values: payloadValues(p),
        idempotencyKey: `guest-mail-${p.id}`,
      },
      files,
    );
    await finish(p.id, true, null, sent.id, sent.subject);
    return { ok: true as const, subject: sent.subject };
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo enviar.";
    await finish(p.id, false, message, null, null).catch(() => {});
    return { ok: false as const, failure: message };
  }
}

/** Cron: everything due now (in small batches so a run fits the time limit). */
export async function deliverGuestMail(options: { max?: number } = {}) {
  if (!mailConfigured()) return { sent: 0, failed: 0, skipped: "RESEND_API_KEY missing" };
  const { data, error } = await admin().rpc("pms_service_guest_mail_claim", { max_items: options.max ?? 20 });
  if (error) throw new Error("guest mail queue unavailable");
  const claimed = (data ?? []) as GuestMailPayload[];
  const files: Files = new Map();
  let sent = 0,
    failed = 0;
  for (const p of claimed) {
    const r = await deliverPayload(p, files);
    if (r.ok) sent++;
    else failed++;
  }
  return { sent, failed };
}

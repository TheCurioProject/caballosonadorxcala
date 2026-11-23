import { NextResponse } from "next/server";
import { z } from "zod";
import { body, failure } from "@/cala/infrastructure/http/server";
import { assertOrigin } from "@/cala/lib/runtime";
import { requireCalaAccess } from "@/lib/cala/access";
import { DomainError, invariant } from "@/cala/domain/shared/errors";
import { untyped } from "@/lib/cala/connectors/calendar-sync";
import {
  deliverPayload,
  documentInfo,
  documentLink,
  documentUploadUrl,
  guestReplyTo,
  mailConfigured,
  removeDocumentFile,
  sendGuestEmail,
  type GuestMailDocument,
  type GuestMailPayload,
} from "@/lib/cala/guest-mail";
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "@/cala/domain/messaging/guest-email";
import { messageValues } from "@/cala/domain/messaging/templates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const id = z.string().uuid();
const button = z.object({ label: z.string().trim().min(1).max(60), url: z.string().trim().min(1).max(2000) });
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("state"), propertyId: id }),
  z.object({
    action: z.literal("document.upload"),
    propertyId: id,
    fileName: z.string().trim().min(1).max(200),
    contentType: z.string().max(200),
    size: z.number().int().min(1),
  }),
  z.object({
    action: z.literal("document.save"),
    propertyId: id,
    path: z.string().min(10).max(600),
    name: z.string().trim().min(1).max(160),
    fileName: z.string().trim().min(1).max(200),
  }),
  z.object({ action: z.literal("document.delete"), propertyId: id, documentId: id }),
  z.object({ action: z.literal("document.open"), propertyId: id, documentId: id }),
  z.object({ action: z.literal("delivery.skip"), propertyId: id, templateId: id, reservationId: id }),
  z.object({ action: z.literal("delivery.restore"), propertyId: id, templateId: id, reservationId: id }),
  z.object({
    action: z.literal("delivery.send"),
    propertyId: id,
    templateId: id,
    reservationId: id,
    mode: z.enum(["auto", "manual"]),
  }),
  z.object({
    action: z.literal("test.send"),
    propertyId: id,
    reservationId: id.nullable().optional(),
    locale: z.string().min(2).max(5),
    subject: z.string().max(200),
    body: z.string().min(1).max(10000),
    buttons: z.array(button).max(3),
    documentIds: z.array(id).max(5),
  }),
]);

const sqlErrors: Record<string, [string, number]> = {
  FORBIDDEN: ["Tu acceso no permite gestionar mensajes a huéspedes en esta propiedad.", 403],
  NOT_FOUND: ["El registro ya no existe. Recarga la vista.", 404],
  INVALID_DOCUMENT: ["El archivo no pertenece a esta propiedad.", 422],
  NO_GUEST_EMAIL: ["Esta reserva no tiene un correo de huésped válido. Añádelo en la ficha del huésped.", 422],
  ALREADY_SENT: ["Este mensaje ya se envió (o se está enviando) a esta reserva.", 409],
  UNKNOWN_VARIABLE: ["La plantilla contiene una variable desconocida.", 422],
};

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { client, organizationId, user } = await requireCalaAccess();
    const cmd = input.parse(await body(request));
    const db = untyped(client);
    const rpc = async (type: string, extra: Record<string, unknown> = {}) => {
      const { data, error } = await db.rpc("pms_guest_mail", {
        command: { type, organizationId, propertyId: cmd.propertyId, ...extra },
      });
      if (error) {
        const [message, status] =
          sqlErrors[error.message] ??
          (error.code === "42501" ? sqlErrors.FORBIDDEN : ["No se pudo completar. Inténtalo de nuevo.", 409]);
        throw new DomainError(error.message in sqlErrors ? error.message : "GUEST_MAIL_REJECTED", message, status);
      }
      return data as Record<string, unknown>;
    };
    const documentsById = async (ids: string[]) => {
      if (!ids.length) return [] as GuestMailDocument[];
      // RLS: only documents of properties this person can read.
      const { data } = await db
        .from("message_documents")
        .select("id,name,file_name,content_type,storage_path,size_bytes,property_id")
        .in("id", ids)
        .eq("property_id", cmd.propertyId);
      const rows = (data ?? []) as {
        id: string;
        name: string;
        file_name: string;
        content_type: string;
        storage_path: string;
        size_bytes: number;
      }[];
      return ids
        .map((x) => rows.find((r) => r.id === x))
        .filter((r): r is (typeof rows)[number] => Boolean(r))
        .map((r) => ({
          id: r.id,
          name: r.name,
          fileName: r.file_name,
          contentType: r.content_type,
          storagePath: r.storage_path,
          size: r.size_bytes,
        }));
    };

    switch (cmd.action) {
      case "state": {
        const state = await rpc("state");
        return NextResponse.json({
          ...state,
          ready: mailConfigured(),
          replyTo: await guestReplyTo(cmd.propertyId).catch(() => null),
          you: user.email ?? null,
        });
      }
      case "document.upload": {
        await rpc("gate");
        invariant(
          cmd.contentType in DOCUMENT_TYPES,
          "DOCUMENT_TYPE",
          "Sube un PDF, Word, Excel, PowerPoint, texto o imagen.",
          422,
        );
        invariant(cmd.size <= MAX_DOCUMENT_BYTES, "DOCUMENT_SIZE", "Cada archivo puede pesar hasta 10 MB.", 413);
        return NextResponse.json(await documentUploadUrl(organizationId, cmd.propertyId, cmd.fileName));
      }
      case "document.save": {
        await rpc("gate");
        invariant(
          cmd.path.startsWith(`${organizationId}/${cmd.propertyId}/`) && !cmd.path.includes(".."),
          "INVALID_DOCUMENT",
          sqlErrors.INVALID_DOCUMENT[0],
          422,
        );
        const info = await documentInfo(cmd.path);
        if (info.size < 1 || info.size > MAX_DOCUMENT_BYTES || !(info.contentType in DOCUMENT_TYPES)) {
          await removeDocumentFile(cmd.path).catch(() => {});
          throw new DomainError("DOCUMENT_TYPE", "El archivo no es válido o pesa más de 10 MB.", 422);
        }
        const saved = await rpc("document.save", {
          name: cmd.name,
          fileName: cmd.fileName,
          contentType: info.contentType,
          size: info.size,
          storagePath: cmd.path,
        });
        return NextResponse.json(saved);
      }
      case "document.delete": {
        const r = await rpc("document.delete", { id: cmd.documentId });
        if (typeof r.storagePath === "string") await removeDocumentFile(r.storagePath).catch(() => {});
        return NextResponse.json({ ok: true });
      }
      case "document.open": {
        const [doc] = await documentsById([cmd.documentId]);
        invariant(Boolean(doc), "NOT_FOUND", "El documento ya no existe.", 404);
        return NextResponse.json({ url: await documentLink(doc.storagePath, doc.fileName) });
      }
      case "delivery.skip":
      case "delivery.restore":
        return NextResponse.json(
          await rpc(cmd.action, { templateId: cmd.templateId, reservationId: cmd.reservationId }),
        );
      case "delivery.send": {
        invariant(mailConfigured(), "MAIL_NOT_READY", "Falta RESEND_API_KEY en el servidor para enviar correos.", 503);
        const payload = (await rpc("delivery.send", {
          templateId: cmd.templateId,
          reservationId: cmd.reservationId,
          mode: cmd.mode,
        })) as unknown as GuestMailPayload;
        const r = await deliverPayload(payload);
        return NextResponse.json(r.ok ? { status: "sent", recipient: payload.recipient } : { status: "failed", failure: r.failure });
      }
      case "test.send": {
        await rpc("gate");
        invariant(Boolean(user.email), "NO_EMAIL", "Tu cuenta no tiene correo.", 422);
        const { data: property } = await db
          .from("properties")
          .select("name")
          .eq("id", cmd.propertyId)
          .maybeSingle();
        const { data: settings } = await db
          .from("property_settings")
          .select("check_in_from,check_out_until")
          .eq("property_id", cmd.propertyId)
          .maybeSingle();
        const s = (settings ?? {}) as { check_in_from?: string; check_out_until?: string };
        const propertyName = String((property as { name?: string } | null)?.name ?? "CALA");
        const base = {
          propertyName,
          checkIn: String(s.check_in_from ?? "15:00").slice(0, 5),
          checkOut: String(s.check_out_until ?? "11:00").slice(0, 5),
        };
        let values;
        if (cmd.reservationId) {
          const { data: r } = await db
            .from("reservations")
            .select("arrival_date,departure_date,confirmation_code,adults,children,guest_id")
            .eq("id", cmd.reservationId)
            .eq("property_id", cmd.propertyId)
            .maybeSingle();
          invariant(Boolean(r), "NOT_FOUND", "La reserva ya no existe.", 404);
          const res = r as {
            arrival_date: string;
            departure_date: string;
            confirmation_code: string;
            adults: number;
            children: number;
            guest_id: string;
          };
          const { data: g } = await db.from("guests").select("first_name,last_name").eq("id", res.guest_id).maybeSingle();
          const { data: u } = await db
            .from("reservation_units")
            .select("units(name)")
            .eq("reservation_id", cmd.reservationId)
            .not("unit_id", "is", null)
            .limit(1)
            .maybeSingle();
          const guest = g as { first_name: string; last_name: string } | null;
          values = messageValues(
            {
              ...base,
              guest: guest ? { firstName: guest.first_name, lastName: guest.last_name } : undefined,
              arrival: res.arrival_date,
              departure: res.departure_date,
              confirmationCode: res.confirmation_code,
              unitName: (u as { units?: { name?: string } } | null)?.units?.name ?? null,
              adults: res.adults,
              children: res.children,
            },
            cmd.locale,
          );
        } else {
          const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
          values = messageValues(
            {
              ...base,
              guest: { firstName: "Ana", lastName: "García" },
              arrival: day(14),
              departure: day(17),
              confirmationCode: "PRUEBA-123",
              unitName: "Habitación 1",
              adults: 2,
              children: 0,
            },
            cmd.locale,
          );
        }
        const sent = await sendGuestEmail({
          to: user.email!,
          propertyId: cmd.propertyId,
          propertyName,
          locale: cmd.locale,
          subject: cmd.subject,
          body: cmd.body,
          buttons: cmd.buttons,
          documents: await documentsById(cmd.documentIds),
          values,
          subjectPrefix: "[Prueba] ",
        }).catch((e) => {
          throw new DomainError("SEND_FAILED", e instanceof Error ? e.message : "No se pudo enviar.", 502);
        });
        return NextResponse.json({ ok: true, to: user.email, subject: sent.subject });
      }
    }
  } catch (error) {
    return failure(error);
  }
}

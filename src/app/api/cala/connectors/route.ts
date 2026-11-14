import { NextResponse } from "next/server";
import { z } from "zod";
import { body, failure } from "@/cala/infrastructure/http/server";
import { assertOrigin } from "@/cala/lib/runtime";
import { requireCalaAccess } from "@/lib/cala/access";
import { DomainError, invariant } from "@/cala/domain/shared/errors";
import { publicCalendar } from "@/cala/infrastructure/public-calendar";
import {
  bookedEvents,
  fetchCalendar,
  normalizeCalendarUrl,
  parseOtaCalendar,
  providerForUrl,
} from "@/lib/cala/connectors/ical-feed";
import { syncCalendarLink, untyped } from "@/lib/cala/connectors/calendar-sync";
import { configureMail, inboxAddress, mailSetup, receivingDomains } from "@/lib/cala/connectors/mail";
import { isWebsiteProperty, revalidatePublicSite } from "@/lib/revalidatePublic";
import { retireLegacySource } from "@/lib/cala/connectors/legacy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const provider = z.enum(["airbnb", "booking", "expedia", "vrbo", "other"]);
const id = z.string().uuid();
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("state"), propertyId: id }),
  z.object({ action: z.literal("calendar.inspect"), propertyId: id, url: z.string().min(1).max(2000) }),
  z.object({ action: z.literal("calendar.connect"), propertyId: id, unitId: id, provider, url: z.string().min(1).max(2000) }),
  z.object({ action: z.literal("calendar.sync"), propertyId: id, linkId: id }),
  z.object({ action: z.literal("calendar.unlink"), propertyId: id, linkId: id }),
  z.object({ action: z.literal("calendar.export"), propertyId: id, unitId: id, provider, rotate: z.boolean().optional() }),
  z.object({ action: z.literal("inbox.enable"), propertyId: id }),
  z.object({ action: z.literal("mail.configure"), propertyId: id, domain: z.string().min(3).max(320) }),
  z.object({ action: z.literal("inbox.list"), propertyId: id }),
  z.object({ action: z.literal("thread.reply"), propertyId: id, threadId: id, body: z.string().min(1).max(20000), manual: z.boolean().optional() }),
  z.object({ action: z.literal("thread.note"), propertyId: id, threadId: id, body: z.string().min(1).max(20000) }),
  z.object({ action: z.literal("thread.cancel"), propertyId: id, messageId: id }),
  z.object({
    action: z.literal("thread.update"),
    propertyId: id,
    threadId: id,
    version: z.number().int(),
    status: z.enum(["open", "archived"]).optional(),
    assigneeId: id.nullable().optional(),
    reservationId: id.nullable().optional(),
  }),
]);

const sqlErrors: Record<string, [string, number]> = {
  FORBIDDEN: ["Tu acceso no permite gestionar canales o mensajes en esta propiedad.", 403],
  INVALID_UNIT: ["Elige una habitación o casa activa de esta propiedad.", 422],
  INVALID_PROVIDER: ["Elige un canal compatible.", 422],
  INVALID_CALENDAR_URL: ["El enlace del calendario debe empezar por https://", 422],
  NOT_FOUND: ["El registro ya no existe. Recarga la vista.", 404],
  NO_REPLY_ADDRESS: [
    "Aún no tenemos la dirección de respuesta de esta conversación: llegará con el próximo mensaje del huésped.",
    409,
  ],
  VERSION_CONFLICT: ["Otra persona cambió esta conversación. Recarga y vuelve a intentarlo.", 409],
  VERSION_CONFLICT_OR_MESSAGE_STATE: ["Ese mensaje ya salió o se canceló.", 409],
  INVALID_MESSAGE: ["Escribe un mensaje.", 422],
};

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { client, organizationId } = await requireCalaAccess();
    const cmd = input.parse(await body(request));
    const db = untyped(client);
    const origin = request.headers.get("origin")!;
    const rpc = async (type: string, extra: Record<string, unknown> = {}) => {
      const { data, error } = await db.rpc("pms_connector", {
        command: { type, organizationId, propertyId: cmd.propertyId, ...extra },
      });
      if (error) {
        const [message, status] = sqlErrors[error.message] ??
          (error.code === "42501" ? sqlErrors.FORBIDDEN : ["No se pudo completar. Inténtalo de nuevo.", 409]);
        throw new DomainError(error.message in sqlErrors ? error.message : "CONNECTOR_REJECTED", message, status);
      }
      return data as Record<string, unknown>;
    };
    const exportUrl = (token: string) => `${origin}/api/cala/ical/?token=${token}`;

    switch (cmd.action) {
      case "state": {
        const state = await rpc("state");
        const setup = await mailSetup();
        const inbox = state.inbox as { localPart: string } | null;
        let suggestions: string[] = [];
        if (setup.apiKey && !setup.receiving) suggestions = await receivingDomains().catch(() => []);
        return NextResponse.json({
          ...state,
          inbox: inbox && setup.domain ? { ...inbox, address: inboxAddress(inbox.localPart, setup.domain) } : inbox,
          mail: { apiKey: setup.apiKey, receiving: setup.receiving, webhook: setup.webhook, domain: setup.domain || null, suggestions },
          webhookUrl: `${origin}/api/cala/inbound-email/`,
        });
      }
      case "mail.configure": {
        await rpc("state"); // channel.manage required
        const r = await configureMail(cmd.domain, `${origin}/api/cala/inbound-email/`);
        return NextResponse.json({ ok: true, domain: r.domain });
      }
      case "calendar.inspect": {
        await rpc("state"); // permission gate before the server fetches anything
        const url = normalizeCalendarUrl(cmd.url);
        invariant(
          !url.startsWith(origin) && !url.includes("/api/cala/ical"),
          "OWN_CALENDAR",
          "Ese es el enlace de CALA. Aquí va el enlace que te da la OTA (el de exportar su calendario).",
          422,
        );
        const events = parseOtaCalendar(await fetchCalendar(url));
        const today = new Date().toISOString().slice(0, 10);
        const current = events.filter((e) => !e.cancelled && e.departure >= today);
        const upcoming = bookedEvents(current).sort((a, b) => a.arrival.localeCompare(b.arrival));
        return NextResponse.json({
          ok: true,
          detected: providerForUrl(url),
          total: events.length,
          upcoming: upcoming.length,
          // "Airbnb (Not available)" marks: shown to the user, never imported.
          ignored: current.length - upcoming.length,
          sample: upcoming.slice(0, 8).map(({ arrival, departure, summary }) => ({ arrival, departure, summary })),
        });
      }
      case "calendar.connect": {
        const url = normalizeCalendarUrl(cmd.url);
        await rpc("state");
        parseOtaCalendar(await fetchCalendar(url)); // proven readable before saving
        const link = await rpc("calendar.link", { unitId: cmd.unitId, provider: cmd.provider, url });
        const result = await syncCalendarLink(String(link.id));
        if (result.ok && isWebsiteProperty(cmd.propertyId)) {
          await retireLegacySource(url);
          revalidatePublicSite();
        }
        return NextResponse.json({ id: link.id, ...result });
      }
      case "calendar.sync": {
        const state = await rpc("state");
        invariant(
          (state.links as { id: string }[]).some((l) => l.id === cmd.linkId),
          "NOT_FOUND",
          "La conexión de calendario ya no existe.",
          404,
        );
        const result = await syncCalendarLink(cmd.linkId);
        if (isWebsiteProperty(cmd.propertyId)) revalidatePublicSite();
        return NextResponse.json(result);
      }
      case "calendar.unlink": {
        const result = await rpc("calendar.unlink", { id: cmd.linkId });
        if (isWebsiteProperty(cmd.propertyId)) revalidatePublicSite();
        return NextResponse.json(result);
      }
      case "calendar.export": {
        const r = await rpc("calendar.export", { unitId: cmd.unitId, provider: cmd.provider, rotate: cmd.rotate ?? false });
        const token = String(r.token);
        // Self-test: the feed must answer with a valid calendar before the user pastes it.
        const calendar = await publicCalendar(request, token);
        return NextResponse.json({
          url: exportUrl(token),
          events: calendar.events.filter((e) => e.exportable && !e.cancelled).length,
        });
      }
      case "inbox.enable": {
        const r = await rpc("inbox.enable");
        const setup = await mailSetup();
        return NextResponse.json({ localPart: r.localPart, address: setup.domain ? inboxAddress(String(r.localPart), setup.domain) : null });
      }
      case "inbox.list":
        return NextResponse.json(await rpc("inbox.list"));
      case "thread.reply":
        // Replies are sent inside the OTA (copy + open); CALA records them.
        return NextResponse.json(await rpc("thread.reply", { threadId: cmd.threadId, body: cmd.body, manual: true }));
      case "thread.note":
        return NextResponse.json(await rpc("thread.note", { threadId: cmd.threadId, body: cmd.body }));
      case "thread.cancel":
        return NextResponse.json(await rpc("thread.cancel", { id: cmd.messageId }));
      case "thread.update": {
        const { action: _a, propertyId: _p, ...rest } = cmd;
        void _a;
        void _p;
        return NextResponse.json(await rpc("thread.update", rest));
      }
    }
  } catch (error) {
    return failure(error);
  }
}

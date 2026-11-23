"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Empty, Modal, SectionTitle } from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import { useI18n } from "@/cala/lib/i18n";
import { dateTime } from "@/cala/lib/format";
import type { MessageTemplate } from "@/cala/domain/model";
import {
  messageValues,
  messageVariables,
  validateTemplate,
} from "@/cala/domain/messaging/templates";
import {
  buildGuestEmail,
  buttonProblem,
  DOCUMENT_ACCEPT,
  DOCUMENT_TYPES,
  MAX_BUTTONS,
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS,
  type EmailButton,
} from "@/cala/domain/messaging/guest-email";

// ---- API ---------------------------------------------------------------------

type GuestDocument = {
  id: string;
  name: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
};
type Upcoming = { templateId: string; reservationId: string; dueAt: string; recipient: string };
type Delivery = {
  id: string;
  templateId: string | null;
  reservationId: string;
  kind: "auto" | "manual";
  status: "sending" | "sent" | "failed" | "skipped";
  recipient: string | null;
  subject: string;
  failure: string | null;
  dueAt: string | null;
  sentAt: string | null;
  createdAt: string;
};
type GuestMailState = {
  documents: GuestDocument[];
  upcoming: Upcoming[];
  history: Delivery[];
  ready: boolean;
  replyTo: string | null;
  you: string | null;
  /** When this state was fetched (client clock). */
  loadedAt: number;
};

async function guestMail<T = Record<string, unknown>>(action: string, payload: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/cala/guest-mail/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
      cache: "no-store",
    });
  } catch {
    throw new Error("Sin conexión a internet. Revisa tu red e inténtalo de nuevo.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(typeof data.message === "string" ? data.message : "No se pudo completar. Inténtalo de nuevo.");
  return data as T;
}

function useGuestMail(propertyId: string) {
  const [state, setState] = useState<GuestMailState | null>(null);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const next = await guestMail<GuestMailState>("state", { propertyId });
      if (alive.current) {
        setState({ ...next, loadedAt: Date.now() });
        setError("");
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "No se pudo cargar.");
    }
  }, [propertyId]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);
  return { state, error, refresh };
}

function guessType(file: File) {
  if (file.type && file.type in DOCUMENT_TYPES) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const byExt: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    ics: "text/calendar",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return byExt[ext] ?? file.type ?? "";
}

/** Browser → Storage directly (no 4.5 MB Vercel limit), then registered in CALA. */
async function uploadDocument(propertyId: string, file: File) {
  const contentType = guessType(file);
  if (!(contentType in DOCUMENT_TYPES)) throw new Error("Sube un PDF, Word, Excel, PowerPoint, texto o imagen.");
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("Cada archivo puede pesar hasta 10 MB.");
  const { path, signedUrl } = await guestMail<{ path: string; signedUrl: string }>("document.upload", {
    propertyId,
    fileName: file.name,
    contentType,
    size: file.size,
  });
  const put = await fetch(signedUrl, {
    method: "PUT",
    headers: { "content-type": contentType, "x-upsert": "false" },
    body: file,
  }).catch(() => null);
  if (!put?.ok) throw new Error("No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo.");
  return guestMail<{ id: string }>("document.save", {
    propertyId,
    path,
    name: file.name.replace(/\.[^.]+$/, "").slice(0, 160) || file.name,
    fileName: file.name.slice(0, 200),
  });
}

const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// ---- wording -----------------------------------------------------------------

const eventLabel: Record<string, string> = {
  booking: "la reserva",
  arrival: "la llegada",
  departure: "la salida",
};
function useTiming() {
  const { t } = useI18n();
  return (x: Pick<MessageTemplate, "trigger" | "offsetDays" | "sendTime" | "autoSend">) => {
    if (!x.autoSend || x.trigger === "manual") return t("Solo uso manual");
    const event = t(eventLabel[x.trigger]);
    const time = x.sendTime ?? "10:00";
    const n = Math.abs(x.offsetDays);
    if (x.offsetDays === 0) return t("El día de {event} a las {time}", { event, time });
    return t(
      x.offsetDays < 0
        ? n === 1
          ? "1 día antes de {event} a las {time}"
          : "{n} días antes de {event} a las {time}"
        : n === 1
          ? "1 día después de {event} a las {time}"
          : "{n} días después de {event} a las {time}",
      { n: String(n), event, time },
    );
  };
}

// ---- screen ------------------------------------------------------------------

export function Templates() {
  const { data } = useWorkspace();
  return <GuestMessages key={data.currentPropertyId} />;
}

function GuestMessages() {
  const { data, can, command, notify } = useWorkspace();
  const { t } = useI18n();
  const propertyId = data.currentPropertyId;
  const mail = useGuestMail(propertyId);
  const timing = useTiming();
  const [tab, setTab] = useState<"templates" | "scheduled" | "documents">("templates");
  const [editing, setEditing] = useState<MessageTemplate | "new" | null>(null);
  const [deleting, setDeleting] = useState<MessageTemplate | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const writable = can("message.write");
  const templates = data.messageTemplates.filter((x) => x.propertyId === propertyId);
  const documents = mail.state?.documents ?? [];
  const pending = (mail.state?.upcoming ?? []).length;

  return (
    <>
      <SectionTitle
        eyebrow="UNA BIENVENIDA A TU MEDIDA"
        title="Plantillas de mensajes"
        description="Mensajes por idioma con variables, botones y documentos. Prográmalos para que lleguen solos al correo del huésped."
      >
        <Link href="/admin/inbox" className="button secondary">
          Volver al inbox
        </Link>
        {writable && (
          <button className="button primary" onClick={() => setEditing("new")}>
            Nueva plantilla
          </button>
        )}
      </SectionTitle>
      <div className="tabs guest-mail-tabs" aria-label={t("Vista de mensajes")}>
        {(
          [
            ["templates", "Plantillas", templates.length],
            ["scheduled", "Programados", pending],
            ["documents", "Documentos", documents.length],
          ] as const
        ).map(([key, label, n]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {t(label)} {n > 0 && <span>{n}</span>}
          </button>
        ))}
      </div>
      {mail.error && (
        <div className="notice error" role="alert">
          {mail.error}
        </div>
      )}
      {mail.state && !mail.state.ready && (
        <div className="notice warning">
          Falta RESEND_API_KEY en el servidor: los mensajes programados no saldrán hasta configurarla.
        </div>
      )}

      {tab === "templates" && (
        <>
          <div className="notice guest-mail-notice">
            {t(
              "Las plantillas con «Envío automático» se mandan solas al correo registrado del huésped, a la hora de la propiedad. Las respuestas del huésped llegan a {replyTo}.",
              {
                replyTo:
                  mail.state?.replyTo ??
                  t("ningún correo (conecta tu correo en Mensajes → Conectar para recibirlas)"),
              },
            )}
          </div>
          <div className="card-grid">
            {templates.map((x) => (
              <article className="card guest-mail-card" key={x.id}>
                <span className="eyebrow">
                  {x.locale} · {timing(x)}
                </span>
                <h2>{x.name}</h2>
                <strong>{x.subject}</strong>
                <p className="template-excerpt">{x.body}</p>
                <div className="guest-mail-tags">
                  {x.autoSend && x.trigger !== "manual" ? (
                    <span className="badge badge-sent">{t("Envío automático")}</span>
                  ) : (
                    <span className="badge">{t("Manual")}</span>
                  )}
                  {(x.buttons?.length ?? 0) > 0 && (
                    <span className="badge">{t("{n} botón(es)", { n: String(x.buttons!.length) })}</span>
                  )}
                  {(x.documentIds?.length ?? 0) > 0 && (
                    <span className="badge">{t("{n} adjunto(s)", { n: String(x.documentIds!.length) })}</span>
                  )}
                </div>
                {writable && (
                  <div className="row">
                    <button className="button secondary" onClick={() => setEditing({ ...x })}>
                      Editar y previsualizar
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setError("");
                        setDeleting({ ...x });
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
          {!templates.length && (
            <Empty
              asset="empty-messages"
              title="Prepara tu primera bienvenida"
              description="Crea plantillas para confirmación, llegada, instrucciones y despedida."
            />
          )}
        </>
      )}

      {tab === "scheduled" && (
        <Scheduled
          state={mail.state}
          refresh={mail.refresh}
          templates={templates}
          writable={writable}
        />
      )}

      {tab === "documents" && (
        <Documents
          documents={documents}
          templates={templates}
          refresh={mail.refresh}
          writable={writable}
          loading={!mail.state}
        />
      )}

      {editing && (
        <TemplateEditor
          template={editing === "new" ? undefined : editing}
          documents={documents}
          you={mail.state?.you ?? null}
          refreshDocuments={mail.refresh}
          onClose={(saved) => {
            setEditing(null);
            if (saved) void mail.refresh();
          }}
        />
      )}
      {deleting && (
        <Modal
          title="Eliminar plantilla"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p>
            {t(
              "Se eliminará «{name}». Los mensajes que ya preparaste conservarán su contenido y dejarán de enviarse los programados con esta plantilla.",
              { name: deleting.name },
            )}
          </p>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await command({ type: "template.delete", id: deleting.id, version: deleting.version });
                setDeleting(null);
                notify(t("Plantilla eliminada"));
                void mail.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "No se pudo eliminar.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Eliminando…" : "Eliminar plantilla"}
          </button>
        </Modal>
      )}
    </>
  );
}

// ---- scheduled ---------------------------------------------------------------

function Scheduled({
  state,
  refresh,
  templates,
  writable,
}: {
  state: GuestMailState | null;
  refresh: () => Promise<void>;
  templates: MessageTemplate[];
  writable: boolean;
}) {
  const { data, notify } = useWorkspace();
  const { t } = useI18n();
  const [working, setWorking] = useState("");
  const [manual, setManual] = useState(false);
  const label = (reservationId: string) => {
    const r = data.reservations.find((x) => x.id === reservationId);
    const g = r && data.guests.find((x) => x.id === r.guestId);
    return {
      guest: g ? `${g.firstName} ${g.lastName}`.trim() : t("Huésped"),
      code: r?.confirmationCode ?? "",
    };
  };
  const templateName = (id: string | null) =>
    templates.find((x) => x.id === id)?.name ?? t("Plantilla eliminada");
  const act = async (key: string, action: string, payload: Record<string, unknown>, done: string) => {
    setWorking(key);
    try {
      const r = await guestMail<{ status?: string; failure?: string }>(action, {
        propertyId: data.currentPropertyId,
        ...payload,
      });
      if (r.status === "failed") notify(r.failure ?? t("No se pudo enviar."), "error");
      else notify(t(done));
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("No se pudo completar."), "error");
    } finally {
      setWorking("");
    }
  };
  if (!state) return <div className="panel guest-mail-panel muted">{t("Cargando…")}</div>;
  const now = state.loadedAt;
  const skipped = state.history.filter((x) => x.status === "skipped");
  const history = state.history.filter((x) => x.status !== "skipped");
  return (
    <div className="guest-mail-stack">
      <section className="panel guest-mail-panel">
        <div className="guest-mail-head">
          <div>
            <h2>{t("Próximos envíos")}</h2>
            <p className="muted">
              {t("Mensajes automáticos de los próximos 45 días. Puedes enviarlos ya u omitirlos para una reserva.")}
            </p>
          </div>
          {writable && (
            <button className="button secondary" onClick={() => setManual(true)} disabled={!templates.length}>
              {t("Enviar a una reserva")}
            </button>
          )}
        </div>
        {state.upcoming.length === 0 && (
          <p className="muted guest-mail-empty">
            {t("No hay envíos programados. Activa «Envío automático» en una plantilla.")}
          </p>
        )}
        {state.upcoming.map((x) => {
          const l = label(x.reservationId);
          const key = `${x.templateId}:${x.reservationId}`;
          const queued = Date.parse(x.dueAt) <= now;
          return (
            <div className="list-row guest-mail-row" key={key}>
              <div>
                <strong data-no-translate>
                  {l.guest} {l.code && <small>· {l.code}</small>}
                </strong>
                <p>
                  <span data-no-translate>{templateName(x.templateId)}</span> ·{" "}
                  {queued ? t("Sale en los próximos minutos") : dateTime(x.dueAt)} ·{" "}
                  <span data-no-translate>{x.recipient}</span>
                </p>
              </div>
              {writable && (
                <div className="row">
                  <button
                    className="button secondary"
                    disabled={Boolean(working)}
                    onClick={() =>
                      act(key, "delivery.send", { templateId: x.templateId, reservationId: x.reservationId, mode: "auto" }, "Mensaje enviado")
                    }
                  >
                    {working === key ? t("Enviando…") : t("Enviar ahora")}
                  </button>
                  <button
                    className="button secondary"
                    disabled={Boolean(working)}
                    onClick={() =>
                      act(key + ":skip", "delivery.skip", { templateId: x.templateId, reservationId: x.reservationId }, "Envío omitido")
                    }
                  >
                    {t("Omitir")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {skipped.length > 0 && (
          <>
            <h3 className="guest-mail-subhead">{t("Omitidos")}</h3>
            {skipped.map((x) => {
              const l = label(x.reservationId);
              return (
                <div className="list-row guest-mail-row" key={x.id}>
                  <div>
                    <strong data-no-translate>
                      {l.guest} {l.code && <small>· {l.code}</small>}
                    </strong>
                    <p data-no-translate>{templateName(x.templateId)}</p>
                  </div>
                  {writable && x.templateId && (
                    <button
                      className="button secondary"
                      disabled={Boolean(working)}
                      onClick={() =>
                        act(x.id, "delivery.restore", { templateId: x.templateId, reservationId: x.reservationId }, "Envío restaurado")
                      }
                    >
                      {t("Restaurar")}
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </section>
      <section className="panel guest-mail-panel">
        <div className="guest-mail-head">
          <div>
            <h2>{t("Historial")}</h2>
            <p className="muted">{t("Los últimos correos enviados a huéspedes desde CALA.")}</p>
          </div>
        </div>
        {history.length === 0 && <p className="muted guest-mail-empty">{t("Aún no se ha enviado ningún correo.")}</p>}
        {history.map((x) => {
          const l = label(x.reservationId);
          return (
            <div className="list-row guest-mail-row" key={x.id}>
              <div>
                <strong data-no-translate>{x.subject || templateName(x.templateId)}</strong>
                <p>
                  <span data-no-translate>
                    {l.guest}
                    {l.code ? ` · ${l.code}` : ""} · {x.recipient}
                  </span>{" "}
                  · {dateTime(x.sentAt ?? x.createdAt)}
                </p>
                {x.failure && <p className="guest-mail-failure">{x.failure}</p>}
              </div>
              <div className="row">
                <span
                  className={`badge badge-${x.status === "sent" ? "sent" : x.status === "failed" ? "failed" : "queued"}`}
                >
                  {t(x.status === "sent" ? "Enviado" : x.status === "failed" ? "Fallido" : "Enviando")}
                </span>
                {writable && x.status === "failed" && x.templateId && (
                  <button
                    className="button secondary"
                    disabled={Boolean(working)}
                    onClick={() =>
                      act(
                        x.id,
                        "delivery.send",
                        { templateId: x.templateId, reservationId: x.reservationId, mode: x.kind },
                        "Mensaje enviado",
                      )
                    }
                  >
                    {working === x.id ? t("Enviando…") : t("Reintentar")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
      {manual && (
        <ManualSend
          templates={templates}
          onClose={(sent) => {
            setManual(false);
            if (sent) void refresh();
          }}
        />
      )}
    </div>
  );
}

function ManualSend({ templates, onClose }: { templates: MessageTemplate[]; onClose: (sent: boolean) => void }) {
  const { data, notify } = useWorkspace();
  const { t } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const reservations = data.reservations
    .filter(
      (r) =>
        r.propertyId === data.currentPropertyId &&
        !["cancelled", "no_show", "draft"].includes(r.status) &&
        r.departure >= today,
    )
    .sort((a, b) => a.arrival.localeCompare(b.arrival));
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [reservationId, setReservationId] = useState(reservations[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guestOf = (id: string) => {
    const r = data.reservations.find((x) => x.id === id);
    return r ? data.guests.find((g) => g.id === r.guestId) : undefined;
  };
  const guest = guestOf(reservationId);
  return (
    <Modal title="Enviar a una reserva" onClose={() => !busy && onClose(false)}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const r = await guestMail<{ status: string; failure?: string; recipient?: string }>("delivery.send", {
              propertyId: data.currentPropertyId,
              templateId,
              reservationId,
              mode: "manual",
            });
            if (r.status === "failed") throw new Error(r.failure ?? "No se pudo enviar.");
            notify(t("Mensaje enviado a {to}", { to: r.recipient ?? "" }));
            onClose(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo enviar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="plain-fieldset">
          <label className="field">
            <span>Plantilla</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
              {templates.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.locale})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Reserva</span>
            <select value={reservationId} onChange={(e) => setReservationId(e.target.value)} required>
              {reservations.map((r) => {
                const g = data.guests.find((x) => x.id === r.guestId);
                return (
                  <option key={r.id} value={r.id}>
                    {r.confirmationCode} · {g ? `${g.firstName} ${g.lastName}` : ""} · {r.arrival}
                  </option>
                );
              })}
            </select>
          </label>
          <p className="muted" data-no-translate>
            {guest?.email ? `→ ${guest.email}` : t("Esta reserva no tiene correo de huésped.")}
          </p>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <button className="button primary" disabled={busy || !templateId || !reservationId || !guest?.email}>
            {busy ? "Enviando…" : "Enviar ahora"}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}

// ---- documents ---------------------------------------------------------------

function Documents({
  documents,
  templates,
  refresh,
  writable,
  loading,
}: {
  documents: GuestDocument[];
  templates: MessageTemplate[];
  refresh: () => Promise<void>;
  writable: boolean;
  loading: boolean;
}) {
  const { data, notify, refresh: refreshWorkspace } = useWorkspace();
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<GuestDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const usedBy = (id: string) => templates.filter((x) => x.documentIds?.includes(id));
  const open = async (d: GuestDocument) => {
    try {
      const { url } = await guestMail<{ url: string }>("document.open", {
        propertyId: data.currentPropertyId,
        documentId: d.id,
      });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      notify(e instanceof Error ? e.message : t("No se pudo abrir."), "error");
    }
  };
  return (
    <section className="panel guest-mail-panel">
      <div className="guest-mail-head">
        <div>
          <h2>{t("Documentos para adjuntar")}</h2>
          <p className="muted">
            {t("Guías de llegada, menús, reglamentos o mapas. Se guardan en CALA y puedes adjuntarlos a cualquier plantilla. PDF, Word, Excel, imágenes; hasta 10 MB cada uno.")}
          </p>
        </div>
        {writable && (
          <>
            <input
              ref={input}
              type="file"
              hidden
              multiple
              accept={DOCUMENT_ACCEPT}
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (!files.length) return;
                setUploading(true);
                let ok = 0;
                for (const f of files) {
                  try {
                    await uploadDocument(data.currentPropertyId, f);
                    ok++;
                  } catch (err) {
                    notify(`${f.name}: ${err instanceof Error ? err.message : t("No se pudo subir.")}`, "error");
                  }
                }
                setUploading(false);
                if (ok) notify(t("{n} documento(s) guardado(s)", { n: String(ok) }));
                await refresh();
              }}
            />
            <button className="button primary" disabled={uploading} onClick={() => input.current?.click()}>
              {uploading ? t("Subiendo…") : t("Subir documento")}
            </button>
          </>
        )}
      </div>
      {loading && <p className="muted guest-mail-empty">{t("Cargando…")}</p>}
      {!loading && documents.length === 0 && (
        <p className="muted guest-mail-empty">{t("Aún no has subido documentos.")}</p>
      )}
      {documents.map((d) => {
        const used = usedBy(d.id);
        return (
          <div className="list-row guest-mail-row" key={d.id}>
            <div>
              <strong data-no-translate>{d.name}</strong>
              <p>
                <span data-no-translate>{d.fileName}</span> · {t(DOCUMENT_TYPES[d.contentType] ?? "Archivo")} ·{" "}
                {fileSize(d.size)}
                {used.length > 0 && (
                  <>
                    {" "}
                    · {t("En")} <span data-no-translate>{used.map((x) => x.name).join(", ")}</span>
                  </>
                )}
              </p>
            </div>
            <div className="row">
              <button className="button secondary" onClick={() => open(d)}>
                {t("Ver")}
              </button>
              {writable && (
                <button className="button secondary" onClick={() => setDeleting(d)}>
                  {t("Eliminar")}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {deleting && (
        <Modal title="Eliminar documento" onClose={() => !busy && setDeleting(null)}>
          <p>
            {t("Se eliminará «{name}» y se quitará de las plantillas que lo adjuntan.", { name: deleting.name })}
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await guestMail("document.delete", { propertyId: data.currentPropertyId, documentId: deleting.id });
                setDeleting(null);
                notify(t("Documento eliminado"));
                await Promise.all([refresh(), refreshWorkspace()]);
              } catch (e) {
                notify(e instanceof Error ? e.message : t("No se pudo eliminar."), "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Eliminando…" : "Eliminar documento"}
          </button>
        </Modal>
      )}
    </section>
  );
}

// ---- editor ------------------------------------------------------------------

const LOCALES = ["es", "en", "de", "fr", "it", "pt", "nl", "pl", "el", "hu"];

function TemplateEditor({
  template,
  documents,
  you,
  refreshDocuments,
  onClose,
}: {
  template?: MessageTemplate;
  documents: GuestDocument[];
  you: string | null;
  refreshDocuments: () => Promise<void>;
  onClose: (saved: boolean) => void;
}) {
  const { data, command, notify } = useWorkspace();
  const { t } = useI18n();
  const timing = useTiming();
  const [name, setName] = useState(template?.name ?? "");
  const [locale, setLocale] = useState(template?.locale ?? "es");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [autoSend, setAutoSend] = useState(Boolean(template?.autoSend));
  const [trigger, setTrigger] = useState<"booking" | "arrival" | "departure">(
    template && template.trigger !== "manual" ? template.trigger : "arrival",
  );
  const initialOffset = template?.trigger !== "manual" ? (template?.offsetDays ?? -2) : -2;
  const [direction, setDirection] = useState<"before" | "same" | "after">(
    initialOffset < 0 ? "before" : initialOffset > 0 ? "after" : "same",
  );
  const [days, setDays] = useState(Math.max(1, Math.abs(initialOffset)));
  const [sendTime, setSendTime] = useState(template?.sendTime ?? "10:00");
  const [buttons, setButtons] = useState<EmailButton[]>(template?.buttons ?? []);
  const [documentIds, setDocumentIds] = useState<string[]>(template?.documentIds ?? []);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  // Sample stay for the preview: two weeks from when the editor opened.
  const [sample] = useState(() => {
    const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    return { arrival: day(14), departure: day(17) };
  });
  const [uploading, setUploading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const offsetDays = direction === "same" ? 0 : direction === "before" ? -days : days;
  const savedTrigger = autoSend ? trigger : template?.trigger === "manual" || !template ? "manual" : trigger;
  const reservations = data.reservations
    .filter((r) => r.propertyId === data.currentPropertyId)
    .sort((a, b) => b.arrival.localeCompare(a.arrival));
  const property = data.properties.find((p) => p.id === data.currentPropertyId);
  const attached = documentIds
    .map((x) => documents.find((d) => d.id === x))
    .filter((d): d is GuestDocument => Boolean(d));

  let validation = "";
  try {
    validateTemplate(body);
    validateTemplate(subject);
    for (const b of buttons) {
      const problem = buttonProblem(b);
      if (problem) throw new Error(problem);
      validateTemplate(b.url);
      validateTemplate(b.label);
    }
  } catch (e) {
    validation = e instanceof Error ? e.message : "Variables inválidas";
  }

  const email = useMemo(() => {
    if (validation || !property) return null;
    const r = reservations.find((x) => x.id === preview);
    const g = r ? data.guests.find((x) => x.id === r.guestId) : undefined;
    const unit = r ? data.units.find((u) => u.id === r.unitId) : undefined;
    const values = messageValues(
      {
        guest: r ? g : { firstName: "Ana", lastName: "García" },
        propertyName: property.name,
        checkIn: property.checkIn,
        checkOut: property.checkOut,
        arrival: r?.arrival ?? sample.arrival,
        departure: r?.departure ?? sample.departure,
        confirmationCode: r?.confirmationCode ?? "PRUEBA-123",
        unitName: r ? unit?.name : "Habitación 1",
        adults: r?.adults ?? 2,
        children: r?.children ?? 0,
      },
      locale,
    );
    try {
      return buildGuestEmail({
        subject,
        body: body || t("Tu mensaje aparecerá aquí."),
        buttons,
        attachments: attached,
        propertyName: property.name,
        locale,
        values,
      });
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validation, property, preview, subject, body, buttons, attached.length, locale]);

  const insertVariable = (v: string) => {
    const el = bodyRef.current;
    const token = `{{${v}}}`;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length,
      end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const content = () => ({
    locale,
    subject,
    body,
    buttons: buttons.map((b) => ({ label: b.label.trim(), url: b.url.trim() })),
    documentIds,
  });

  return (
    <Modal
      title={template ? "Editar plantilla" : "Nueva plantilla"}
      onClose={() => {
        if (!busy) onClose(false);
      }}
      wide
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || validation) return;
          setBusy(true);
          setError("");
          try {
            await command({
              type: "template.save",
              ...(template ? { id: template.id, version: template.version } : {}),
              name,
              ...content(),
              trigger: savedTrigger,
              offsetDays: savedTrigger === "manual" ? 0 : offsetDays,
              autoSend: autoSend,
              sendTime,
            });
            notify(t("Plantilla guardada"));
            onClose(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo guardar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="plain-fieldset guest-mail-editor">
          <div className="form-grid">
            <label className="field">
              <span>Nombre</span>
              <input maxLength={160} required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>Idioma</span>
              <select value={locale} onChange={(e) => setLocale(e.target.value)}>
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Asunto</span>
            <input maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="field">
            <span>Mensaje</span>
            <textarea
              ref={bodyRef}
              required
              rows={8}
              maxLength={10000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <div className="template-variables" aria-label={t("Insertar variable")}>
            {messageVariables.map((v) => (
              <button className="button secondary" type="button" key={v} onClick={() => insertVariable(v)}>
                {v}
              </button>
            ))}
          </div>
          <p className="muted guest-mail-help">
            {t("Las variables se reemplazan con los datos de cada reserva. Deja una línea en blanco para separar párrafos; los enlaces https:// se vuelven clicables.")}
          </p>

          <section className="guest-mail-block">
            <div className="guest-mail-block-head">
              <h3>{t("Botones con enlace")}</h3>
              {buttons.length < MAX_BUTTONS && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setButtons((b) => [...b, { label: "", url: "https://" }])}
                >
                  {t("Añadir botón")}
                </button>
              )}
            </div>
            {buttons.length === 0 && (
              <p className="muted">{t("Por ejemplo «Cómo llegar» con un enlace de Google Maps o «Check-in en línea».")}</p>
            )}
            {buttons.map((b, i) => {
              const problem = b.label || b.url !== "https://" ? buttonProblem(b) : "";
              return (
                <div className="guest-mail-button-row" key={i}>
                  <label className="field">
                    <span>{t("Texto del botón")}</span>
                    <input
                      maxLength={60}
                      value={b.label}
                      onChange={(e) =>
                        setButtons((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>{t("Enlace")}</span>
                    <input
                      inputMode="url"
                      maxLength={2000}
                      value={b.url}
                      placeholder="https://"
                      onChange={(e) =>
                        setButtons((all) => all.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                      }
                    />
                  </label>
                  <div className="guest-mail-button-actions">
                    <button
                      type="button"
                      className="button secondary"
                      aria-label={t("Subir")}
                      disabled={i === 0}
                      onClick={() =>
                        setButtons((all) => {
                          const next = [...all];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          return next;
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setButtons((all) => all.filter((_, j) => j !== i))}
                    >
                      {t("Quitar")}
                    </button>
                  </div>
                  {problem && <p className="guest-mail-failure">{t(problem)}</p>}
                </div>
              );
            })}
          </section>

          <section className="guest-mail-block">
            <div className="guest-mail-block-head">
              <h3>{t("Documentos adjuntos")}</h3>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept={DOCUMENT_ACCEPT}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setUploading(true);
                  try {
                    const { id } = await uploadDocument(data.currentPropertyId, f);
                    await refreshDocuments();
                    setDocumentIds((ids) => (ids.length < MAX_DOCUMENTS ? [...ids, id] : ids));
                  } catch (err) {
                    notify(err instanceof Error ? err.message : t("No se pudo subir."), "error");
                  } finally {
                    setUploading(false);
                  }
                }}
              />
              <button
                type="button"
                className="button secondary"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? t("Subiendo…") : t("Subir documento")}
              </button>
            </div>
            {documents.length === 0 && (
              <p className="muted">{t("Sube un PDF (por ejemplo la guía de llegada) para enviarlo con este mensaje.")}</p>
            )}
            <div className="guest-mail-docs">
              {documents.map((d) => {
                const checked = documentIds.includes(d.id);
                return (
                  <label className="checkbox-label" key={d.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && documentIds.length >= MAX_DOCUMENTS}
                      onChange={(e) =>
                        setDocumentIds((ids) => (e.target.checked ? [...ids, d.id] : ids.filter((x) => x !== d.id)))
                      }
                    />
                    <span data-no-translate>
                      {d.name} <small className="muted">· {fileSize(d.size)}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="guest-mail-block">
            <label className="checkbox-label guest-mail-auto">
              <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} />
              <span>
                <strong>{t("Envío automático por correo")}</strong>
                <small className="muted">
                  {t("CALA lo manda solo al correo registrado del huésped de cada reserva confirmada.")}
                </small>
              </span>
            </label>
            {autoSend && (
              <>
                <div className="guest-mail-when">
                  <label className="field">
                    <span>{t("Cuándo")}</span>
                    <select value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)}>
                      <option value="before">{t("Días antes de")}</option>
                      <option value="same">{t("El mismo día de")}</option>
                      <option value="after">{t("Días después de")}</option>
                    </select>
                  </label>
                  {direction !== "same" && (
                    <label className="field">
                      <span>{t("Días")}</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={days}
                        onChange={(e) => setDays(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
                      />
                    </label>
                  )}
                  <label className="field">
                    <span>{t("Evento")}</span>
                    <select value={trigger} onChange={(e) => setTrigger(e.target.value as typeof trigger)}>
                      <option value="arrival">{t("La llegada")}</option>
                      <option value="departure">{t("La salida")}</option>
                      <option value="booking">{t("La reserva")}</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>{t("Hora")}</span>
                    <input type="time" required value={sendTime} onChange={(e) => setSendTime(e.target.value)} />
                  </label>
                </div>
                <p className="notice guest-mail-summary">
                  {t("Se enviará {when} (hora de la propiedad). Si alguien reserva después de ese momento, lo recibe al reservar.", {
                    when: timing({ autoSend: true, trigger, offsetDays, sendTime }).toLowerCase(),
                  })}
                </p>
              </>
            )}
          </section>

          <section className="guest-mail-block">
            <div className="guest-mail-block-head">
              <h3>{t("Vista previa del correo")}</h3>
              <select value={preview} onChange={(e) => setPreview(e.target.value)} aria-label={t("Vista previa con una reserva")}>
                <option value="">{t("Datos de ejemplo")}</option>
                {reservations.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.confirmationCode}
                  </option>
                ))}
              </select>
            </div>
            {email ? (
              <>
                <p className="guest-mail-subject" data-no-translate>
                  <strong>{email.subject}</strong>
                </p>
                <iframe
                  className="guest-mail-preview"
                  title={t("Vista previa del correo")}
                  sandbox=""
                  srcDoc={email.html}
                />
              </>
            ) : (
              <p className="muted">{t("Corrige el mensaje para ver la vista previa.")}</p>
            )}
            <div className="row">
              <button
                type="button"
                className="button secondary"
                disabled={testing || Boolean(validation) || !body.trim()}
                onClick={async () => {
                  setTesting(true);
                  try {
                    const r = await guestMail<{ to: string }>("test.send", {
                      propertyId: data.currentPropertyId,
                      reservationId: preview || null,
                      ...content(),
                    });
                    notify(t("Prueba enviada a {to}", { to: r.to }));
                  } catch (e) {
                    notify(e instanceof Error ? e.message : t("No se pudo enviar."), "error");
                  } finally {
                    setTesting(false);
                  }
                }}
              >
                {testing ? t("Enviando…") : you ? t("Enviarme una prueba ({to})", { to: you }) : t("Enviarme una prueba")}
              </button>
            </div>
          </section>

          {(validation || error) && (
            <div className="notice error" role="alert">
              {error || validation}
            </div>
          )}
          <button className="button primary" disabled={busy || Boolean(validation)}>
            {busy ? "Guardando…" : "Guardar plantilla"}
          </button>
        </fieldset>
      </form>
    </Modal>
  );
}

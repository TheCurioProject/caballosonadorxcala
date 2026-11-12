"use client";
import { uiLocale } from "@/cala/lib/format";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { Badge, Empty, Icon, Modal, SectionTitle } from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import { ReservationInspector, guestName } from "@/cala/features/reservations/components";
import { dateTime, shortDate } from "@/cala/lib/format";
import { renderMessage } from "@/cala/domain/messaging/templates";
import { providerForSource } from "@/cala/domain/messaging/ota";
import { connector, otaGuides, type ConnectorProvider } from "@/cala/features/integrations/connectors";
import { copyText } from "@/cala/features/integrations/calendar-assistant";
import { MessageAssistant } from "./message-assistant";
import { useI18n } from "@/cala/lib/i18n";

/**
 * OTA inbox. Only conversations that arrived from an OTA (through the e-mail
 * relay) live here: a direct booking has no channel that could deliver a reply.
 */
type Thread = {
  id: string;
  provider: ConnectorProvider;
  guestName: string;
  canReply: boolean;
  externalUrl: string | null;
  externalCode: string | null;
  reservationId: string | null;
  status: "open" | "archived";
  assigneeId: string | null;
  lastMessageAt: string;
  version: number;
};
type Message = {
  id: string;
  threadId: string;
  direction: "inbound" | "outbound" | "internal";
  status: "received" | "queued" | "sending" | "sent" | "failed" | "cancelled" | "recorded";
  subject: string | null;
  body: string;
  failure: string | null;
  createdAt: string;
  sentAt: string | null;
};
type InboxData = { threads: Thread[]; messages: Message[]; inbox: { localPart: string } | null };
type Folder = "all" | "unread" | "mine" | "pending" | "archived";
const folders: [Folder, string][] = [
  ["all", "Todas"],
  ["unread", "Sin leer"],
  ["mine", "Mías"],
  ["pending", "En cola"],
  ["archived", "Archivadas"],
];

// ---- "seen" marks: per-browser unread tracking --------------------------
const seenKey = "cala.inbox.seen.ota";
const seenListeners = new Set<() => void>();
let seenCache = "";
let seenValue: Record<string, string> = {};
function seenSnapshot() {
  let raw = "{}";
  try {
    raw = localStorage.getItem(seenKey) ?? "{}";
  } catch {
    /* storage unavailable */
  }
  if (raw !== seenCache) {
    seenCache = raw;
    try {
      seenValue = JSON.parse(raw);
    } catch {
      seenValue = {};
    }
  }
  return seenValue;
}
const emptySeen: Record<string, string> = {};
function useSeen() {
  return useSyncExternalStore(
    (notify) => {
      seenListeners.add(notify);
      return () => seenListeners.delete(notify);
    },
    seenSnapshot,
    () => emptySeen,
  );
}
function markSeen(id: string, at: string) {
  try {
    const all = { ...seenSnapshot() };
    if (all[id] && all[id] >= at) return;
    all[id] = at;
    localStorage.setItem(seenKey, JSON.stringify(all));
    seenListeners.forEach((n) => n());
  } catch {
    /* storage unavailable */
  }
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}
function relative(iso: string, now: number) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = (now - t) / 60000;
  if (diff < 1) return "ahora";
  if (diff < 60) return `${Math.round(diff)} min`;
  if (diff < 60 * 24) return `${Math.round(diff / 60)} h`;
  if (diff < 60 * 24 * 7) return new Intl.DateTimeFormat(uiLocale(), { weekday: "short" }).format(t);
  return new Intl.DateTimeFormat(uiLocale(), { day: "numeric", month: "short" }).format(t);
}
function dayHeading(iso: string) {
  return new Intl.DateTimeFormat(uiLocale(), { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}
function ChannelMark({ provider, size = "md" }: { provider: ConnectorProvider; size?: "sm" | "md" }) {
  const g = otaGuides[provider];
  return (
    <span className={`ib-channel ib-channel-${size}`} style={{ "--ota-hue": g.hue } as CSSProperties} title={g.label} aria-label={g.label}>
      {g.mark}
    </span>
  );
}
function deliveryLabel(m: Message, via: string) {
  switch (m.status) {
    case "sent":
      return `Enviado por ${via}`;
    case "queued":
    case "sending":
      return `Enviando por ${via}…`;
    case "failed":
      return "No entregado";
    case "cancelled":
      return "Cancelado";
    case "recorded":
      return `Copiado para enviar en ${via}`;
    default:
      return "";
  }
}

export function Inbox({ compact = false }: { compact?: boolean }) {
  const { data } = useWorkspace();
  return <PropertyInbox key={data.currentPropertyId} compact={compact} />;
}

function PropertyInbox({ compact }: { compact: boolean }) {
  const { data, can } = useWorkspace();
  const { t: tr } = useI18n();
  const seen = useSeen();
  const propertyId = data.currentPropertyId;
  const [inbox, setInbox] = useState<InboxData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [folder, setFolder] = useState<Folder>("all");
  const [mode, setMode] = useState<"guest" | "note">("guest");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [info, setInfo] = useState(false);
  const [inspect, setInspect] = useState<string | null>(null);
  const [assistant, setAssistant] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const timeline = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      const next = await connector<InboxData>("inbox.list", { propertyId });
      setInbox(next);
      setLoadError("");
      setNow(Date.now());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "No se pudo cargar la bandeja.");
    }
  }, [propertyId]);
  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20000);
    return () => window.clearInterval(t);
  }, [load]);

  const threads = inbox?.threads ?? [];
  const byThread = new Map<string, Message[]>();
  for (const m of inbox?.messages ?? []) {
    const list = byThread.get(m.threadId) ?? [];
    list.push(m);
    byThread.set(m.threadId, list);
  }
  const unread = (t: Thread) => {
    const last = [...(byThread.get(t.id) ?? [])].reverse().find((m) => m.direction === "inbound");
    return Boolean(last && (!seen[t.id] || seen[t.id] < last.createdAt));
  };
  const matches = (t: Thread, f: Folder) => {
    if (f === "archived") return t.status === "archived";
    if (t.status === "archived") return false;
    if (f === "unread") return unread(t);
    if (f === "mine") return t.assigneeId === data.currentUser.id;
    if (f === "pending") return (byThread.get(t.id) ?? []).some((m) => ["queued", "sending", "failed"].includes(m.status));
    return true;
  };
  const counts = Object.fromEntries(folders.map(([f]) => [f, threads.filter((t) => matches(t, f)).length])) as Record<Folder, number>;
  const visible = threads.filter((t) => {
    if (source && t.provider !== source) return false;
    if (!matches(t, folder)) return false;
    const list = byThread.get(t.id) ?? [];
    return `${t.guestName} ${t.externalCode ?? ""} ${list.map((m) => m.body).join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  });

  const thread = threads.find((t) => t.id === selected);
  const messages = thread ? (byThread.get(thread.id) ?? []) : [];
  const reservation = thread?.reservationId ? data.reservations.find((r) => r.id === thread.reservationId) : undefined;
  const guest = reservation ? data.guests.find((g) => g.id === reservation.guestId) : undefined;
  const unit = reservation ? data.units.find((u) => u.id === reservation.unitId) : undefined;
  const via = thread ? otaGuides[thread.provider].label : "";
  const body = drafts[selected] ?? "";
  const candidates = thread
    ? data.reservations
        .filter(
          (r) =>
            r.propertyId === propertyId &&
            r.status !== "draft" &&
            (providerForSource(r.source) === thread.provider || providerForSource(r.source) === null) &&
            r.departure >= new Date(now - 30 * 86400000).toISOString().slice(0, 10),
        )
        .sort((a, b) => a.arrival.localeCompare(b.arrival))
    : [];

  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!thread) return;
    const last = messages[messages.length - 1];
    markSeen(thread.id, last?.createdAt ?? new Date().toISOString());
    timeline.current?.scrollTo({ top: timeline.current.scrollHeight, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, lastId]);

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!thread || !body.trim()) return;
    if (mode === "guest") {
      // Airbnb and Booking.com only accept replies in their own chat: copy the
      // text and open that conversation (inside the click, so it isn't blocked).
      const target = thread.externalUrl ?? otaGuides[thread.provider].inbox;
      const copying = copyText(body.trim()); // needs focus: start before opening
      if (target) window.open(target, "_blank", "noopener");
      if (!(await copying)) {
        setError("No se pudo copiar el texto. Selecciónalo y cópialo a mano.");
        return;
      }
    }
    const ok = await run(() =>
      connector(mode === "note" ? "thread.note" : "thread.reply", { propertyId, threadId: thread.id, body: body.trim() }),
    );
    if (ok) {
      setDrafts((d) => ({ ...d, [thread.id]: "" }));
      setSent(true);
      window.setTimeout(() => setSent(false), 1200);
    }
  }
  const updateThread = (patch: Record<string, unknown>) =>
    thread && run(() => connector("thread.update", { propertyId, threadId: thread.id, version: thread.version, ...patch }));
  function applyTemplate(id: string) {
    const template = data.messageTemplates.find((x) => x.id === id);
    if (!template || !reservation || !thread) return;
    try {
      const text = renderMessage(template.body, {
        guest,
        property: data.properties.find((p) => p.id === reservation.propertyId)!,
        reservation,
        unit,
      });
      setDrafts((d) => ({ ...d, [thread.id]: text }));
      textarea.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar.");
    }
  }
  function open(id: string) {
    setSelected(id);
    setError("");
    setInfo(false);
    if (compact) window.scrollTo({ top: 0, behavior: "instant" });
  }

  const providersInUse = [...new Set(threads.map((t) => t.provider))];
  const list = (
    <aside className="ib-list" aria-label="Conversaciones">
      <div className="ib-search">
        <Icon name="search" size={16} />
        <input type="search" aria-label="Buscar conversaciones" placeholder="Buscar huésped, reserva o mensaje" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="ib-folders" role="tablist" aria-label="Bandejas">
        {folders.map(([key, label]) => (
          <button type="button" role="tab" key={key} aria-selected={folder === key} className={folder === key ? "active" : ""} onClick={() => setFolder(key)}>
            {label}
            {counts[key] > 0 && key !== "all" && <span>{counts[key]}</span>}
          </button>
        ))}
      </div>
      {providersInUse.length > 1 && (
        <label className="ib-source">
          <span className="sr-only">Canal</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Todos los canales</option>
            {providersInUse.map((p) => (
              <option key={p} value={p}>
                {otaGuides[p].label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="ib-threads">
        {visible.map((t, i) => {
          const items = byThread.get(t.id) ?? [];
          const last = items[items.length - 1];
          const r = t.reservationId ? data.reservations.find((x) => x.id === t.reservationId) : undefined;
          const isUnread = unread(t);
          return (
            <button
              type="button"
              key={t.id}
              className={`ib-thread${selected === t.id ? " active" : ""}${isUnread ? " is-unread" : ""}`}
              style={{ "--i": Math.min(i, 12) } as CSSProperties}
              aria-pressed={selected === t.id}
              onClick={() => open(t.id)}
            >
              <span className="ib-avatar">
                {initials(t.guestName)}
                <ChannelMark provider={t.provider} size="sm" />
              </span>
              <span className="ib-thread-body">
                <span className="ib-thread-top">
                  <strong>{t.guestName}</strong>
                  <time>{relative(t.lastMessageAt, now)}</time>
                </span>
                <small className="ib-thread-stay">
                  {r ? `${shortDate(r.arrival)} – ${shortDate(r.departure)}` : otaGuides[t.provider].label}
                  {t.externalCode ? ` · ${t.externalCode}` : ""}
                </small>
                <span className="ib-thread-preview">
                  {drafts[t.id] ? (
                    <em>Borrador: <span data-no-translate>{drafts[t.id]}</span></em>
                  ) : last ? (
                    <>
                      {last.direction === "internal" ? "Nota: " : last.direction === "outbound" ? "Tú: " : ""}
                      <span data-no-translate>{last.body}</span>
                    </>
                  ) : null}
                </span>
              </span>
              {isUnread && <i className="ib-unread" aria-label="Sin leer" />}
            </button>
          );
        })}
        {inbox && !visible.length && (
          <Empty asset="empty-messages" title="Sin conversaciones" description={threads.length ? "Ninguna conversación coincide con los filtros." : "Cuando un huésped te escriba por una OTA conectada, la conversación aparecerá aquí."} />
        )}
        {!inbox && !loadError && (
          <p className="ota-inline" role="status">
            <Icon name="spinner" size={16} /> Cargando conversaciones…
          </p>
        )}
      </div>
    </aside>
  );

  const details = thread && (
    <aside className="ib-details" aria-label="Detalles de la conversación">
      <div className="ib-guest">
        <span className="ib-avatar ib-avatar-lg">{initials(thread.guestName)}</span>
        <div>
          <strong>{thread.guestName}</strong>
          <small>{via}</small>
        </div>
      </div>
      {reservation ? (
        <dl className="ib-facts">
          <div>
            <dt>Reserva</dt>
            <dd>{reservation.confirmationCode}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              <Badge status={reservation.status} />
            </dd>
          </div>
          <div>
            <dt>Huésped</dt>
            <dd>{guestName(data.guests, reservation.guestId)}</dd>
          </div>
          <div>
            <dt>Llegada</dt>
            <dd>{shortDate(reservation.arrival)}</dd>
          </div>
          <div>
            <dt>Salida</dt>
            <dd>{shortDate(reservation.departure)}</dd>
          </div>
          <div>
            <dt>Unidad</dt>
            <dd>{unit?.name ?? "Sin asignar"}</dd>
          </div>
        </dl>
      ) : (
        <p className="muted">
          {thread.externalCode ? `Código ${thread.externalCode}. ` : ""}Esta conversación aún no está vinculada a una reserva de CALA.
        </p>
      )}
      {can("message.write") && (
        <label className="field">
          <span>Reserva vinculada</span>
          <select value={thread.reservationId ?? ""} disabled={busy} onChange={(e) => void updateThread({ reservationId: e.target.value || null })}>
            <option value="">Sin vincular</option>
            {candidates.map((r) => (
              <option key={r.id} value={r.id}>
                {guestName(data.guests, r.guestId)} · {shortDate(r.arrival)} · {r.confirmationCode}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="ib-link-card is-on">
        <ChannelMark provider={thread.provider} />
        <div>
          <strong>{via}</strong>
          <small>{thread.externalUrl ? "Respondes en el chat de la OTA: CALA abre esta conversación" : "Respondes en el chat de la OTA: CALA abre tu bandeja de la OTA"}</small>
        </div>
        {(thread.externalUrl ?? otaGuides[thread.provider].inbox) && (
          <a className="button secondary" href={thread.externalUrl ?? otaGuides[thread.provider].inbox} target="_blank" rel="noreferrer">
            <Icon name="external-link" size={16} />
            Abrir
          </a>
        )}
      </div>
      <div className="ib-detail-actions">
        {reservation && (
          <button type="button" className="button secondary" onClick={() => setInspect(reservation.id)}>
            <Icon name="reservation" size={16} />
            Abrir reserva
          </button>
        )}
        {can("message.write") && (
          <>
            <button type="button" className="button secondary" disabled={busy} onClick={() => void updateThread({ assigneeId: thread.assigneeId === data.currentUser.id ? null : data.currentUser.id })}>
              {thread.assigneeId === data.currentUser.id ? "Dejar asignación" : "Asignarme"}
            </button>
            <button type="button" className="button secondary" disabled={busy} onClick={() => void updateThread({ status: thread.status === "archived" ? "open" : "archived" })}>
              {thread.status === "archived" ? "Reabrir" : "Archivar"}
            </button>
          </>
        )}
      </div>
    </aside>
  );

  const conversationView = thread ? (
    <section className="ib-conversation" aria-label="Conversación">
      <header className="ib-head">
        <button type="button" className="icon-button ib-back" aria-label="Volver a la bandeja" onClick={() => setSelected("")}>
          <Icon name="chevron-left" />
        </button>
        <span className="ib-avatar">
          {initials(thread.guestName)}
          <ChannelMark provider={thread.provider} size="sm" />
        </span>
        <div className="ib-head-text">
          <h2>{thread.guestName}</h2>
          <p>
            {via}
            {reservation && ` · ${shortDate(reservation.arrival)} – ${shortDate(reservation.departure)}`}
            {thread.assigneeId === data.currentUser.id && " · Asignada a ti"}
          </p>
        </div>
        <button type="button" className={`icon-button ib-info-toggle${info ? " active" : ""}`} aria-label="Detalles de la conversación" aria-pressed={info} onClick={() => setInfo((v) => !v)}>
          <Icon name="info" />
        </button>
      </header>
      <div className="ib-timeline" ref={timeline} role="log" aria-label="Historial de mensajes">
        {messages.map((m, i) => {
          const heading = i === 0 || messages[i - 1].createdAt.slice(0, 10) !== m.createdAt.slice(0, 10);
          const statusClass = m.status === "failed" ? "blocked" : m.status;
          return (
            <div key={m.id} className="ib-item">
              {heading && (
                <div className="ib-day">
                  <span>{dayHeading(m.createdAt)}</span>
                </div>
              )}
              <article className={`ib-bubble ${m.direction} status-${statusClass}`} style={{ "--i": Math.max(0, i - messages.length + 8) } as CSSProperties}>
                {m.direction === "internal" && (
                  <span className="ib-note-label">
                    <Icon name="eye-off" size={12} /> Nota interna · solo equipo
                  </span>
                )}
                <p data-no-translate>{m.body}</p>
                <footer>
                  <time>{dateTime(m.createdAt)}</time>
                  {m.direction === "outbound" && <span className="ib-delivery">{deliveryLabel(m, via)}</span>}
                </footer>
                {m.status === "failed" && m.failure && (
                  <div className="ib-failure" role="alert">
                    <p>{m.failure}</p>
                    <p>Responde desde {via} para asegurar que llegue.</p>
                  </div>
                )}
                {can("message.write") && m.status === "queued" && (
                  <div className="ib-bubble-actions">
                    <button type="button" disabled={busy} onClick={() => void run(() => connector("thread.cancel", { propertyId, messageId: m.id }))}>
                      Cancelar
                    </button>
                  </div>
                )}
              </article>
            </div>
          );
        })}
      </div>
      {can("message.write") && (
        <form
          className={`ib-composer${mode === "note" ? " is-note" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div className="ib-composer-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "guest"} className={mode === "guest" ? "active" : ""} onClick={() => setMode("guest")}>
              <Icon name="message" size={14} />
              Huésped
            </button>
            <button type="button" role="tab" aria-selected={mode === "note"} className={mode === "note" ? "active" : ""} onClick={() => setMode("note")}>
              <Icon name="eye-off" size={14} />
              Nota interna
            </button>
            {mode === "guest" && <span className="ib-via">Se envía desde {via}</span>}
          </div>
          <textarea
            ref={textarea}
            maxLength={10000}
            rows={compact ? 2 : 3}
            value={body}
            aria-label={tr(mode === "note" ? "Nota para el equipo" : "Mensaje")}
            placeholder={
              mode === "note"
                ? tr("Escribe una nota que solo verá tu equipo…")
                : tr("Escribe a {name}…", { name: thread.guestName.split(" ")[0] })
            }
            onChange={(e) => setDrafts((d) => ({ ...d, [thread.id]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
          />
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <div className="ib-composer-bar">
            {mode === "guest" && reservation && (
              <label className="ib-tool">
                <Icon name="copy" size={15} />
                <span className="sr-only">Usar plantilla</span>
                <select value="" aria-label="Usar plantilla" onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="">Plantillas</option>
                  {data.messageTemplates
                    .filter((x) => x.propertyId === propertyId)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} · {x.locale}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <span className="ib-spacer" />
            <button className={`button primary ib-send${sent ? " is-sent" : ""}`} disabled={busy || !body.trim()}>
              {sent ? <Icon name="check" size={16} /> : <Icon name={mode === "note" ? "edit" : "external-link"} size={16} />}
              {busy ? "Guardando…" : mode === "note" ? "Guardar nota" : `Copiar y abrir en ${via}`}
            </button>
          </div>
        </form>
      )}
    </section>
  ) : (
    <section className="ib-conversation ib-placeholder">
      <Empty asset="empty-messages" title="Todo empieza con una conversación" description="Elige una conversación para responder al huésped o dejar una nota al equipo." />
    </section>
  );

  const connected = Boolean(inbox?.inbox);
  const onboard = !connected && inbox && (
    <div className="ib-onboard">
      <span className="ib-onboard-marks" aria-hidden="true">
        {(["airbnb", "booking", "vrbo"] as const).map((p) => (
          <span key={p} className="ib-channel" style={{ "--ota-hue": otaGuides[p].hue } as CSSProperties}>
            {otaGuides[p].mark}
          </span>
        ))}
      </span>
      <div>
        <strong>Recibe aquí los mensajes de tus OTAs</strong>
        <small>El asistente te guía para reenviar los avisos de Airbnb, Booking.com, Vrbo o Expedia y comprueba cada paso.</small>
      </div>
      {can("channel.manage") && (
        <button type="button" className="button primary" onClick={() => setAssistant(true)}>
          Iniciar asistente
        </button>
      )}
    </div>
  );

  return (
    <>
      {compact ? (
        !thread && (
          <div className="m-screen-heading">
            <div>
              <p className="eyebrow">MENSAJES DE TUS OTAS</p>
              <h1>Mensajes</h1>
            </div>
            <div className="row">
              <Link className="m-round-button" href="/admin/plantillas" aria-label="Plantillas de mensajes">
                <Icon name="copy" />
              </Link>
              {can("channel.manage") && (
                <button type="button" className="m-round-button" aria-label="Conectar mensajes" onClick={() => setAssistant(true)}>
                  <Icon name="channels" />
                </button>
              )}
            </div>
          </div>
        )
      ) : (
        <SectionTitle eyebrow="MENSAJES DE TUS OTAS" title="Mensajes" description="Responde a huéspedes de Airbnb, Booking.com, Vrbo y Expedia desde un solo lugar.">
          <Link className="button secondary" href="/admin/plantillas">
            <Icon name="copy" />
            Plantillas
          </Link>
          {can("channel.manage") && (
            <button type="button" className="button primary" onClick={() => setAssistant(true)}>
              <Icon name="channels" />
              {connected ? "Asistente de mensajes" : "Conectar mensajes"}
            </button>
          )}
        </SectionTitle>
      )}
      {loadError && (
        <div className="notice error" role="alert">
          <p>{loadError}</p>
          <button type="button" className="button secondary" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      )}
      {(!thread || !compact) && onboard}
      <div className={`ib${compact ? " ib-compact" : ""}${thread ? " has-conversation" : ""}${info ? " show-info" : ""}`}>
        {list}
        {conversationView}
        {details && !compact && details}
      </div>
      {compact && info && details && (
        <Modal title="Conversación" onClose={() => setInfo(false)}>
          {details}
        </Modal>
      )}
      {inspect && <ReservationInspector id={inspect} onClose={() => setInspect(null)} />}
      {assistant && (
        <MessageAssistant
          onClose={() => {
            setAssistant(false);
            void load();
          }}
        />
      )}
    </>
  );
}

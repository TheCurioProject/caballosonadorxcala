"use client";
import { uiLocale } from "@/cala/lib/format";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Badge,
  Empty,
  Icon,
  Modal,
  SectionTitle,
} from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import type { MessageEntry, Reservation } from "@/cala/domain/model";
import {
  guestName,
  ReservationInspector,
} from "@/cala/features/reservations/components";
import { dateTime, money, shortDate } from "@/cala/lib/format";
import { renderMessage } from "@/cala/domain/messaging/templates";
import {
  connectionFor,
  otaCatalog,
  otaList,
  providerForSource,
  sourceLabel,
  type OtaProvider,
} from "@/cala/domain/messaging/ota";
import { dayDistance } from "@/cala/domain/calendar/layout";
import { ConnectAssistant } from "./connect-assistant";

type Composer = {
  body: string;
  subject: string;
  scheduledAt: string;
  id?: string;
  version?: number;
  showSubject: boolean;
  showSchedule: boolean;
};
const emptyComposer: Composer = {
  body: "",
  subject: "",
  scheduledAt: "",
  showSubject: false,
  showSchedule: false,
};
type Folder = "all" | "unread" | "mine" | "drafts" | "pending" | "archived";
const folders: [Folder, string][] = [
  ["all", "Todas"],
  ["unread", "Sin leer"],
  ["mine", "Mías"],
  ["drafts", "Borradores"],
  ["pending", "En cola"],
  ["archived", "Archivadas"],
];

// ---- "seen" marks: per-browser unread tracking --------------------------
const seenKey = "cala.inbox.seen";
const seenListeners = new Set<() => void>();
function readSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(seenKey) ?? "{}");
  } catch {
    return {};
  }
}
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
    seenValue = readSeen();
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
function markSeen(reservationId: string, at: string) {
  try {
    const all = readSeen();
    if (all[reservationId] && all[reservationId] >= at) return;
    all[reservationId] = at;
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
  if (diff < 60 * 24 * 7)
    return new Intl.DateTimeFormat(uiLocale(), { weekday: "short" }).format(t);
  return new Intl.DateTimeFormat(uiLocale(), {
    day: "numeric",
    month: "short",
  }).format(t);
}
function dayHeading(iso: string) {
  return new Intl.DateTimeFormat(uiLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

function ChannelMark({
  source,
  size = "md",
}: {
  source: string;
  size?: "sm" | "md";
}) {
  const p = providerForSource(source);
  const info = p ? otaCatalog[p] : null;
  return (
    <span
      className={`ib-channel ib-channel-${size}${info ? "" : " is-direct"}`}
      style={info ? ({ "--ota-hue": info.hue } as CSSProperties) : undefined}
      title={sourceLabel(source)}
      aria-label={sourceLabel(source)}
    >
      {info?.mark ?? "D"}
    </span>
  );
}

export function Inbox({ compact = false }: { compact?: boolean }) {
  const { data } = useWorkspace();
  const params = useSearchParams(),
    initial = params.get("reservation") ?? "";
  return (
    <PropertyInbox
      key={`${data.currentPropertyId}:${initial}`}
      compact={compact}
      initial={initial}
    />
  );
}

function PropertyInbox({
  compact,
  initial,
}: {
  compact: boolean;
  initial: string;
}) {
  const { data, can, command } = useWorkspace();
  const seen = useSeen();
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [folder, setFolder] = useState<Folder>("all");
  const [mode, setMode] = useState<"guest" | "note">("guest");
  const [composers, setComposers] = useState<Record<string, Composer>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [info, setInfo] = useState(false);
  const [inspect, setInspect] = useState<string | null>(null);
  const [assistant, setAssistant] = useState<{
    provider: OtaProvider | null;
  } | null>(null);
  const [now] = useState(() => Date.now());
  const timeline = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const propertyId = data.currentPropertyId;
  const reservations = data.reservations.filter(
    (r) => r.propertyId === propertyId && r.status !== "draft",
  );
  const entries = data.messageEntries.filter(
    (m) => m.propertyId === propertyId,
  );
  const byReservation = new Map<string, MessageEntry[]>();
  for (const m of entries) {
    const list = byReservation.get(m.reservationId) ?? [];
    list.push(m);
    byReservation.set(m.reservationId, list);
  }
  for (const list of byReservation.values())
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const conversation = (id: string) =>
    data.conversations.find((c) => c.reservationId === id);
  const lastActivity = (r: Reservation) => {
    const list = byReservation.get(r.id);
    return (
      list?.[list.length - 1]?.createdAt ??
      conversation(r.id)?.updatedAt ??
      r.createdAt
    );
  };
  const unread = (r: Reservation) => {
    const last = [...(byReservation.get(r.id) ?? [])]
      .reverse()
      .find((m) => m.direction === "inbound");
    return Boolean(last && (!seen[r.id] || seen[r.id] < last.createdAt));
  };
  const matches = (r: Reservation, f: Folder) => {
    const c = conversation(r.id);
    const list = byReservation.get(r.id) ?? [];
    if (f === "archived") return c?.status === "archived";
    if (c?.status === "archived") return false;
    if (f === "unread") return unread(r);
    if (f === "mine") return c?.assigneeId === data.currentUser.id;
    if (f === "drafts") return list.some((m) => m.status === "draft");
    if (f === "pending") return list.some((m) => m.status === "blocked");
    return true;
  };
  const counts = Object.fromEntries(
    folders.map(([f]) => [f, reservations.filter((r) => matches(r, f)).length]),
  ) as Record<Folder, number>;
  const visible = reservations
    .filter((r) => {
      if (source && sourceLabel(r.source) !== source) return false;
      if (!matches(r, folder)) return false;
      const list = byReservation.get(r.id) ?? [];
      return `${guestName(data.guests, r.guestId)} ${r.confirmationCode} ${list.map((m) => m.body).join(" ")}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase());
    })
    .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));

  const reservation = reservations.find((r) => r.id === selected);
  const thread = reservation ? conversation(reservation.id) : undefined;
  const messages = reservation ? (byReservation.get(reservation.id) ?? []) : [];
  const composer = composers[selected] ?? emptyComposer;
  const guest = reservation
    ? data.guests.find((g) => g.id === reservation.guestId)
    : undefined;
  const provider = reservation ? providerForSource(reservation.source) : null;
  const connection = connectionFor(data.channels, propertyId, provider);
  const via = provider ? otaCatalog[provider].label : "correo";
  const connected = otaList.filter((o) =>
    connectionFor(data.channels, propertyId, o.id),
  );
  const unit = reservation
    ? data.units.find((u) => u.id === reservation.unitId)
    : undefined;

  // Mark as read and keep the newest message in view.
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!reservation) return;
    const last = messages[messages.length - 1];
    markSeen(reservation.id, last?.createdAt ?? new Date().toISOString());
    timeline.current?.scrollTo({
      top: timeline.current.scrollHeight,
      behavior: "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation?.id, lastId]);

  function update(patch: Partial<Composer>) {
    setComposers((all) => ({
      ...all,
      [selected]: { ...(all[selected] ?? emptyComposer), ...patch },
    }));
  }
  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save(kind: "draft" | "note" | "prepare") {
    if (!reservation || !composer.body.trim()) return;
    const ok = await run(() =>
      command({
        type: "message.save",
        reservationId: reservation.id,
        ...(composer.id ? { id: composer.id, version: composer.version } : {}),
        subject: composer.subject,
        body: composer.body,
        mode: kind,
        scheduledAt:
          kind === "note" || !composer.scheduledAt
            ? null
            : new Date(composer.scheduledAt).toISOString(),
      }),
    );
    if (ok) {
      setComposers((all) => ({ ...all, [reservation.id]: { ...emptyComposer } }));
      if (kind !== "draft") {
        setSent(true);
        window.setTimeout(() => setSent(false), 1200);
      }
    }
  }
  function applyTemplate(id: string) {
    const template = data.messageTemplates.find((x) => x.id === id);
    if (!template || !reservation) return;
    try {
      const context = {
        guest,
        property: data.properties.find((p) => p.id === reservation.propertyId)!,
        reservation,
        unit,
      };
      update({
        body: renderMessage(template.body, context),
        subject: renderMessage(template.subject, context),
        showSubject: Boolean(template.subject),
      });
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
  const assign = () =>
    reservation &&
    run(() =>
      command({
        type: "conversation.update",
        reservationId: reservation.id,
        ...(thread ? { version: thread.version } : {}),
        status: thread?.status ?? "open",
        assigneeId:
          thread?.assigneeId === data.currentUser.id
            ? null
            : data.currentUser.id,
      }),
    );
  const archive = () =>
    reservation &&
    run(() =>
      command({
        type: "conversation.update",
        reservationId: reservation.id,
        ...(thread ? { version: thread.version } : {}),
        status: thread?.status === "archived" ? "open" : "archived",
        assigneeId: thread?.assigneeId ?? null,
      }),
    );

  // ---- pieces --------------------------------------------------------------
  const channelStrip = (
    <div className="ib-connections" aria-label="Canales conectados">
      {connected.map((o) => {
        const c = connectionFor(data.channels, propertyId, o.id)!;
        return (
          <button
            type="button"
            key={o.id}
            className="ib-connection"
            onClick={() => setAssistant({ provider: o.id })}
            title="Reconfigurar conexión"
          >
            <span
              className="ib-channel ib-channel-sm"
              style={{ "--ota-hue": o.hue } as CSSProperties}
            >
              {o.mark}
            </span>
            {o.label}
            <small>
              {c.lastSync ? "Sincronizado" : "Esperando autorización"}
            </small>
          </button>
        );
      })}
      <button
        type="button"
        className="ib-connection is-add"
        onClick={() => setAssistant({ provider: null })}
      >
        <Icon name="plus" size={14} />
        Conectar canal
      </button>
    </div>
  );

  const list = (
    <aside className="ib-list" aria-label="Conversaciones">
      <div className="ib-search">
        <Icon name="search" size={16} />
        <input
          type="search"
          aria-label="Buscar conversaciones"
          placeholder="Buscar huésped, reserva o mensaje"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="ib-folders" role="tablist" aria-label="Bandejas">
        {folders.map(([key, label]) => (
          <button
            type="button"
            role="tab"
            key={key}
            aria-selected={folder === key}
            className={folder === key ? "active" : ""}
            onClick={() => setFolder(key)}
          >
            {label}
            {counts[key] > 0 && key !== "all" && <span>{counts[key]}</span>}
          </button>
        ))}
      </div>
      <label className="ib-source">
        <span className="sr-only">Canal</span>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Todos los canales</option>
          {[...new Set(reservations.map((r) => sourceLabel(r.source)))]
            .sort()
            .map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
        </select>
      </label>
      <div className="ib-threads">
        {visible.map((r, i) => {
          const items = byReservation.get(r.id) ?? [];
          const last = items[items.length - 1];
          const name = guestName(data.guests, r.guestId);
          const isUnread = unread(r);
          return (
            <button
              type="button"
              key={r.id}
              className={`ib-thread${selected === r.id ? " active" : ""}${isUnread ? " is-unread" : ""}`}
              style={{ "--i": Math.min(i, 12) } as CSSProperties}
              aria-pressed={selected === r.id}
              onClick={() => open(r.id)}
            >
              <span className="ib-avatar">
                {initials(name)}
                <ChannelMark source={r.source} size="sm" />
              </span>
              <span className="ib-thread-body">
                <span className="ib-thread-top">
                  <strong>{name}</strong>
                  <time>{relative(lastActivity(r), now)}</time>
                </span>
                <small className="ib-thread-stay">
                  {shortDate(r.arrival)} – {shortDate(r.departure)} ·{" "}
                  {data.units.find((u) => u.id === r.unitId)?.name ??
                    "Sin asignar"}
                </small>
                <span className="ib-thread-preview">
                  {composers[r.id]?.body ? (
                    <em>Borrador: {composers[r.id].body}</em>
                  ) : last ? (
                    <>
                      {last.direction === "internal"
                        ? "Nota: "
                        : last.direction === "outbound"
                          ? "Tú: "
                          : ""}
                      {last.body}
                    </>
                  ) : (
                    "Sin mensajes · prepara la bienvenida"
                  )}
                </span>
              </span>
              {isUnread && <i className="ib-unread" aria-label="Sin leer" />}
            </button>
          );
        })}
        {!visible.length && (
          <Empty
            asset="empty-messages"
            title="Sin conversaciones"
            description="Las estancias y sus mensajes aparecerán aquí. Revisa la bandeja o los filtros."
          />
        )}
      </div>
    </aside>
  );

  const details = reservation && (
    <aside className="ib-details" aria-label="Detalles de la reserva">
      <div className="ib-guest">
        <span className="ib-avatar ib-avatar-lg">
          {initials(guestName(data.guests, reservation.guestId))}
        </span>
        <div>
          <strong>{guestName(data.guests, reservation.guestId)}</strong>
          {guest?.country && <small>{guest.country}</small>}
        </div>
      </div>
      {(guest?.email || guest?.phone) && (
        <div className="ib-contact">
          {guest.email && (
            <a href={`mailto:${guest.email}`}>
              <Icon name="email" size={15} />
              {guest.email}
            </a>
          )}
          {guest.phone && (
            <a href={`tel:${guest.phone}`}>
              <Icon name="phone" size={15} />
              {guest.phone}
            </a>
          )}
        </div>
      )}
      <dl className="ib-facts">
        <div>
          <dt>Estado</dt>
          <dd>
            <Badge status={reservation.status} />
          </dd>
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
          <dt>Noches</dt>
          <dd>{dayDistance(reservation.arrival, reservation.departure)}</dd>
        </div>
        <div>
          <dt>Unidad</dt>
          <dd>{unit?.name ?? "Sin asignar"}</dd>
        </div>
        <div>
          <dt>Huéspedes</dt>
          <dd>{reservation.adults + reservation.children}</dd>
        </div>
        <div>
          <dt>Reserva</dt>
          <dd>{reservation.confirmationCode}</dd>
        </div>
        {can("finance.read") && (
          <div>
            <dt>Total</dt>
            <dd>{money(reservation.totalMinor, reservation.currency)}</dd>
          </div>
        )}
      </dl>
      <div className={`ib-link-card${connection || !provider ? " is-on" : ""}`}>
        <ChannelMark source={reservation.source} />
        <div>
          <strong>{sourceLabel(reservation.source)}</strong>
          <small>
            {!provider
              ? "Reserva directa · respuestas por correo"
              : connection
                ? connection.lastSync
                  ? `Sincronizado ${dateTime(connection.lastSync)}`
                  : "Conectado · esperando autorización del canal"
                : "Canal sin conectar"}
          </small>
        </div>
        {provider && !connection && can("channel.manage") && (
          <button
            type="button"
            className="button secondary"
            onClick={() => setAssistant({ provider })}
          >
            Conectar
          </button>
        )}
      </div>
      <div className="ib-detail-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => setInspect(reservation.id)}
        >
          <Icon name="reservation" size={16} />
          Abrir reserva
        </button>
        {can("message.write") && (
          <>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void assign()}
            >
              {thread?.assigneeId === data.currentUser.id
                ? "Dejar asignación"
                : "Asignarme"}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void archive()}
            >
              {thread?.status === "archived" ? "Reabrir" : "Archivar"}
            </button>
          </>
        )}
      </div>
    </aside>
  );

  const conversationView = reservation ? (
    <section className="ib-conversation" aria-label="Conversación">
      <header className="ib-head">
        <button
          type="button"
          className="icon-button ib-back"
          aria-label="Volver a la bandeja"
          onClick={() => setSelected("")}
        >
          <Icon name="chevron-left" />
        </button>
        <span className="ib-avatar">
          {initials(guestName(data.guests, reservation.guestId))}
          <ChannelMark source={reservation.source} size="sm" />
        </span>
        <div className="ib-head-text">
          <h2>{guestName(data.guests, reservation.guestId)}</h2>
          <p>
            {sourceLabel(reservation.source)} · {shortDate(reservation.arrival)}{" "}
            – {shortDate(reservation.departure)}
            {thread?.assigneeId === data.currentUser.id && " · Asignada a ti"}
          </p>
        </div>
        <button
          type="button"
          className={`icon-button ib-info-toggle${info ? " active" : ""}`}
          aria-label="Detalles de la reserva"
          aria-pressed={info}
          onClick={() => setInfo((v) => !v)}
        >
          <Icon name="info" />
        </button>
      </header>
      <div
        className="ib-timeline"
        ref={timeline}
        role="log"
        aria-label="Historial de mensajes"
      >
        {messages.map((m, i) => {
          const heading =
            i === 0 ||
            messages[i - 1].createdAt.slice(0, 10) !== m.createdAt.slice(0, 10);
          return (
            <div key={m.id} className="ib-item">
              {heading && (
                <div className="ib-day">
                  <span>{dayHeading(m.createdAt)}</span>
                </div>
              )}
              <article
                className={`ib-bubble ${m.direction} status-${m.status}`}
                style={{ "--i": Math.max(0, i - messages.length + 8) } as CSSProperties}
              >
                {m.direction === "internal" && (
                  <span className="ib-note-label">
                    <Icon name="eye-off" size={12} /> Nota interna · solo equipo
                  </span>
                )}
                {m.subject && <h3>{m.subject}</h3>}
                <p>{m.body}</p>
                <footer>
                  <time>{dateTime(m.createdAt)}</time>
                  {m.direction === "outbound" && (
                    <span className="ib-delivery">
                      {m.status === "draft"
                        ? "Borrador"
                        : m.status === "sent"
                          ? `Enviado por ${via}`
                          : m.status === "cancelled"
                            ? "Cancelado"
                            : connection
                              ? `En cola · se enviará por ${via}`
                              : provider
                                ? `Pendiente · conecta ${via} para enviarlo`
                                : "Pendiente · proveedor de correo sin configurar"}
                    </span>
                  )}
                  {m.scheduledAt && m.status !== "cancelled" && (
                    <span className="ib-delivery">
                      <Icon name="calendar" size={11} /> {dateTime(m.scheduledAt)}
                    </span>
                  )}
                </footer>
                {can("message.write") &&
                  ["draft", "blocked"].includes(m.status) && (
                    <div className="ib-bubble-actions">
                      {m.status === "draft" && (
                        <button
                          type="button"
                          onClick={() => {
                            update({
                              id: m.id,
                              version: m.version,
                              subject: m.subject,
                              body: m.body,
                              scheduledAt: "",
                              showSubject: Boolean(m.subject),
                            });
                            setMode("guest");
                            textarea.current?.focus();
                          }}
                        >
                          Editar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            command({
                              type: "message.cancel",
                              id: m.id,
                              version: m.version,
                            }),
                          )
                        }
                      >
                        Cancelar
                      </button>
                      {m.status === "blocked" && provider && !connection && can("channel.manage") && (
                        <button
                          type="button"
                          onClick={() => setAssistant({ provider })}
                        >
                          Conectar {via}
                        </button>
                      )}
                    </div>
                  )}
              </article>
            </div>
          );
        })}
        {!messages.length && (
          <div className="ib-start">
            <Icon name="message" size={28} />
            <p>
              Aún no hay mensajes con{" "}
              {guestName(data.guests, reservation.guestId)}. Usa una plantilla
              para dar la bienvenida.
            </p>
          </div>
        )}
      </div>
      {can("message.write") && (
        <form
          className={`ib-composer${mode === "note" ? " is-note" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            void save(mode === "note" ? "note" : "prepare");
          }}
        >
          <div className="ib-composer-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "guest"}
              className={mode === "guest" ? "active" : ""}
              onClick={() => setMode("guest")}
            >
              <Icon name="message" size={14} />
              Huésped
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "note"}
              className={mode === "note" ? "active" : ""}
              onClick={() => setMode("note")}
            >
              <Icon name="eye-off" size={14} />
              Nota interna
            </button>
            {mode === "guest" && (
              <span
                className={`ib-via${connection || !provider ? "" : " is-off"}`}
              >
                Vía {via}
                {provider && !connection && " · sin conectar"}
              </span>
            )}
          </div>
          {mode === "guest" && composer.showSubject && (
            <input
              className="ib-subject"
              maxLength={200}
              placeholder="Asunto (opcional)"
              value={composer.subject}
              onChange={(e) => update({ subject: e.target.value })}
            />
          )}
          <textarea
            ref={textarea}
            maxLength={10000}
            rows={compact ? 2 : 3}
            value={composer.body}
            aria-label={mode === "note" ? "Nota para el equipo" : "Mensaje"}
            placeholder={
              mode === "note"
                ? "Escribe una nota que solo verá tu equipo…"
                : `Escribe a ${guestName(data.guests, reservation.guestId).split(" ")[0]}…`
            }
            onChange={(e) => update({ body: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void save(mode === "note" ? "note" : "prepare");
              }
            }}
          />
          {mode === "guest" && composer.showSchedule && (
            <label className="ib-schedule">
              <span>Enviar el</span>
              <input
                type="datetime-local"
                value={composer.scheduledAt}
                onChange={(e) => update({ scheduledAt: e.target.value })}
              />
            </label>
          )}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <div className="ib-composer-bar">
            {mode === "guest" && (
              <>
                <label className="ib-tool">
                  <Icon name="copy" size={15} />
                  <span className="sr-only">Usar plantilla</span>
                  <select
                    value=""
                    aria-label="Usar plantilla"
                    onChange={(e) => applyTemplate(e.target.value)}
                  >
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
                <button
                  type="button"
                  className={`ib-tool${composer.showSubject ? " active" : ""}`}
                  onClick={() => update({ showSubject: !composer.showSubject })}
                >
                  <Icon name="edit" size={15} />
                  <span className="ib-tool-label">Asunto</span>
                </button>
                <button
                  type="button"
                  className={`ib-tool${composer.showSchedule ? " active" : ""}`}
                  onClick={() =>
                    update({
                      showSchedule: !composer.showSchedule,
                      scheduledAt: composer.showSchedule
                        ? ""
                        : composer.scheduledAt,
                    })
                  }
                >
                  <Icon name="calendar" size={15} />
                  <span className="ib-tool-label">Programar</span>
                </button>
              </>
            )}
            <span className="ib-spacer" />
            {mode === "guest" && (
              <button
                type="button"
                className="button secondary"
                disabled={busy || !composer.body.trim()}
                onClick={() => void save("draft")}
              >
                Borrador
              </button>
            )}
            <button
              className={`button primary ib-send${sent ? " is-sent" : ""}`}
              disabled={busy || !composer.body.trim()}
            >
              {sent ? (
                <Icon name="check" size={16} />
              ) : (
                <Icon name={mode === "note" ? "edit" : "message"} size={16} />
              )}
              {busy
                ? "Guardando…"
                : mode === "note"
                  ? "Guardar nota"
                  : composer.scheduledAt
                    ? "Programar"
                    : "Enviar"}
            </button>
          </div>
        </form>
      )}
    </section>
  ) : (
    <section className="ib-conversation ib-placeholder">
      <Empty
        asset="empty-messages"
        title="Todo empieza con una conversación"
        description="Elige una conversación para responder, dejar una nota al equipo o revisar la reserva."
      />
    </section>
  );

  return (
    <>
      {compact ? (
        !reservation && (
          <div className="m-screen-heading">
            <div>
              <p className="eyebrow">TODOS TUS CANALES</p>
              <h1>Mensajes</h1>
            </div>
            <div className="row">
              <Link
                className="m-round-button"
                href="/admin/plantillas"
                aria-label="Plantillas de mensajes"
              >
                <Icon name="copy" />
              </Link>
              <button
                type="button"
                className="m-round-button"
                aria-label="Conectar canal"
                onClick={() => setAssistant({ provider: null })}
              >
                <Icon name="channels" />
              </button>
            </div>
          </div>
        )
      ) : (
        <SectionTitle
          eyebrow="TODOS TUS CANALES, UNA BANDEJA"
          title="Mensajes"
          description="Responde a huéspedes de Airbnb, Booking.com y reservas directas desde un solo lugar."
        >
          <Link className="button secondary" href="/admin/plantillas">
            <Icon name="copy" />
            Plantillas
          </Link>
          <button
            type="button"
            className="button primary"
            onClick={() => setAssistant({ provider: null })}
          >
            <Icon name="channels" />
            Conectar canal
          </button>
        </SectionTitle>
      )}
      {!reservation || !compact ? (
        connected.length ? (
          channelStrip
        ) : (
          <div className="ib-onboard">
            <span className="ib-onboard-marks" aria-hidden="true">
              {otaList.slice(0, 3).map((o) => (
                <span
                  key={o.id}
                  className="ib-channel"
                  style={{ "--ota-hue": o.hue } as CSSProperties}
                >
                  {o.mark}
                </span>
              ))}
            </span>
            <div>
              <strong>Centraliza los mensajes de tus OTAs</strong>
              <small>
                Conecta Airbnb, Booking.com o Expedia con el asistente guiado.
                Mientras tanto, puedes preparar respuestas y notas.
              </small>
            </div>
            <button
              type="button"
              className="button primary"
              onClick={() => setAssistant({ provider: null })}
            >
              Iniciar asistente
            </button>
          </div>
        )
      ) : null}
      <div
        className={`ib${compact ? " ib-compact" : ""}${reservation ? " has-conversation" : ""}${info ? " show-info" : ""}`}
      >
        {list}
        {conversationView}
        {details && !compact && details}
      </div>
      {compact && info && details && (
        <Modal title="Reserva" onClose={() => setInfo(false)}>
          {details}
        </Modal>
      )}
      {inspect && (
        <ReservationInspector id={inspect} onClose={() => setInspect(null)} />
      )}
      {assistant && (
        <ConnectAssistant
          initialProvider={assistant.provider}
          onClose={() => setAssistant(null)}
        />
      )}
    </>
  );
}

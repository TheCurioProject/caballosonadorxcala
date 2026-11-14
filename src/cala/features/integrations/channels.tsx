"use client";
import { useState } from "react";
import { useWorkspace } from "@/cala/features/workspace/context";
import { SectionTitle, Icon, Empty } from "@/cala/components/ui/primitives";
import { dateTime } from "@/cala/lib/format";
import { useI18n } from "@/cala/lib/i18n";
import { IcalPanel } from "./ical";
import { CalendarAssistant, OtaMark } from "./calendar-assistant";
import { MessageAssistant } from "@/cala/features/messaging/message-assistant";
import {
  connector,
  looksLikeBrowser,
  otaGuides,
  timeAgo,
  useConnectorState,
  type ConnectorProvider,
} from "./connectors";

export function Channels() {
  const { data } = useWorkspace();
  return <PropertyChannels key={data.currentPropertyId} />;
}

function PropertyChannels() {
  const { data, can } = useWorkspace();
  const { t } = useI18n();
  const propertyId = data.currentPropertyId;
  const { state, error, refresh } = useConnectorState(propertyId, 30000);
  const [calendar, setCalendar] = useState<{ unitId?: string; provider?: ConnectorProvider } | null>(null);
  const [messages, setMessages] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const units = data.units.filter((u) => u.propertyId === propertyId);
  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "Unidad";
  const manage = can("channel.manage");

  async function act(key: string, work: () => Promise<string>) {
    setBusy(key);
    setNotice(null);
    try {
      setNotice({ kind: "success", text: await work() });
      await refresh();
    } catch (e) {
      setNotice({ kind: "error", text: e instanceof Error ? e.message : "No se pudo completar." });
    } finally {
      setBusy("");
    }
  }

  const pairs = (state?.links ?? []).map((l) => ({
    link: l,
    feed: state?.feeds.find((f) => f.unitId === l.unitId && f.provider === l.provider),
  }));
  const orphanFeeds = (state?.feeds ?? []).filter((f) => !state?.links.some((l) => l.unitId === f.unitId && l.provider === f.provider));
  const mailReady = Boolean(state?.mail.apiKey && state.mail.receiving && state.mail.webhook);
  const lastMessage = state?.emails.find((e) => e.kind === "message");

  return (
    <>
      <SectionTitle eyebrow="DISTRIBUCIÓN, BAJO CONTROL" title="Canales" description="Calendarios y mensajes de tus OTAs, con el estado real de cada conexión.">
        {manage && (
          <>
            <button type="button" className="button secondary" onClick={() => setMessages(true)}>
              <Icon name="inbox" />
              Conectar mensajes
            </button>
            <button type="button" className="button primary" onClick={() => setCalendar({})}>
              <Icon name="calendar" />
              Conectar calendario
            </button>
          </>
        )}
      </SectionTitle>
      {!manage && <p className="notice">Necesitas el permiso «Gestionar canales» para ver y cambiar las conexiones.</p>}
      {manage && error && (
        <div className="notice error" role="alert">
          <p>{error}</p>
          <button type="button" className="button secondary" onClick={() => void refresh()}>
            Reintentar
          </button>
        </div>
      )}
      {notice && (
        <p className={`notice ${notice.kind}`} role="status">
          {notice.text}
        </p>
      )}
      {manage && state && (
        <>
          <h3 className="cx-section">Calendarios (iCal)</h3>
          <div className="card-grid">
            {pairs.map(({ link, feed }) => {
              const otaRead = feed?.lastFetchedAt && !looksLikeBrowser(feed.agent) ? feed.lastFetchedAt : null;
              const label = otaGuides[link.provider].label;
              return (
                <div className="card cx-card" key={link.id}>
                  <div className="row between">
                    <span className="row">
                      <OtaMark provider={link.provider} />
                      <strong>{label}</strong>
                    </span>
                    <span className={`cx-pill ${link.status === "ok" && otaRead ? "ok" : link.status === "error" ? "bad" : "warn"}`}>
                      {link.status === "error" ? "Error" : otaRead ? "Sincronizado" : "Falta un sentido"}
                    </span>
                  </div>
                  <h3>{unitName(link.unitId)}</h3>
                  <ul className="ota-verify">
                    <li className={link.status === "ok" ? "is-ok" : "is-bad"}>
                      <span>{link.status === "ok" ? <Icon name="check" size={13} /> : <Icon name="warning" size={13} />}</span>
                      {link.status === "ok"
                        ? `${label} → CALA · ${link.blockCount} fechas bloqueadas · ${timeAgo(link.lastSyncAt)}`
                        : link.status === "error"
                          ? `${label} → CALA · ${link.lastError ?? "error"}`
                          : `${label} → CALA · pendiente de leer`}
                    </li>
                    <li className={otaRead ? "is-ok" : "is-bad"}>
                      <span>{otaRead ? <Icon name="check" size={13} /> : <Icon name="warning" size={13} />}</span>
                      {otaRead ? `CALA → ${label} · leído ${timeAgo(otaRead)}` : `CALA → ${label} · ${label} aún no lee tu enlace`}
                    </li>
                    {link.conflictCount > 0 && (
                      <li className="is-bad">
                        <span>
                          <Icon name="warning" size={13} />
                        </span>
                        {link.conflictCount} {link.conflictCount === 1 ? "fecha coincide" : "fechas coinciden"} con reservas de CALA: revisa posibles sobreventas.
                      </li>
                    )}
                  </ul>
                  {link.lastSyncAt && <small className="muted">Última lectura: {dateTime(link.lastSyncAt)} · {link.host}</small>}
                  <div className="row wrap">
                    <button
                      type="button"
                      className="button secondary"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void act(link.id, async () => {
                          const r = await connector<{ ok: boolean; error?: string; active?: number; ignored?: number }>("calendar.sync", { propertyId, linkId: link.id });
                          if (!r.ok) throw new Error(r.error ?? "No pudimos leer el calendario.");
                          return r.ignored
                            ? `${label}: calendario leído, ${r.active ?? 0} fechas bloqueadas y ${r.ignored} periodos «No disponible» ignorados (no son reservas).`
                            : `${label}: calendario leído, ${r.active ?? 0} fechas bloqueadas.`;
                        })
                      }
                    >
                      <Icon name={busy === link.id ? "spinner" : "sync"} size={16} />
                      Sincronizar ahora
                    </button>
                    <button type="button" className="button secondary" onClick={() => setCalendar({ unitId: link.unitId, provider: link.provider })}>
                      {otaRead ? "Revisar" : "Completar"}
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={Boolean(busy)}
                      onClick={() => {
                        if (!window.confirm(t("¿Desconectar {label} de {unit}? Se liberarán las fechas que venían de {label}.", { label, unit: unitName(link.unitId) }))) return;
                        void act(link.id + ":x", async () => {
                          await connector("calendar.unlink", { propertyId, linkId: link.id });
                          return `${label} desconectado. Quita también el enlace de CALA en ${label}.`;
                        });
                      }}
                    >
                      Desconectar
                    </button>
                  </div>
                </div>
              );
            })}
            {orphanFeeds.map((f) => (
              <div className="card cx-card" key={f.unitId + f.provider}>
                <div className="row between">
                  <span className="row">
                    <OtaMark provider={f.provider} />
                    <strong>{otaGuides[f.provider].label}</strong>
                  </span>
                  <span className="cx-pill warn">Falta un sentido</span>
                </div>
                <h3>{unitName(f.unitId)}</h3>
                <p className="muted">Hay un enlace de CALA para {otaGuides[f.provider].label}, pero falta importar su calendario.</p>
                <button type="button" className="button secondary" onClick={() => setCalendar({ unitId: f.unitId, provider: f.provider })}>
                  Completar
                </button>
              </div>
            ))}
          </div>
          {!pairs.length && !orphanFeeds.length && (
            <Empty
              asset="channel-disconnected"
              title="Sin calendarios conectados"
              description="Conecta el calendario de cada habitación o casa con Airbnb, Booking.com o Vrbo para que una reserva en un lado bloquee el otro."
            />
          )}

          <h3 className="cx-section">Mensajes</h3>
          <div className="card cx-card">
            <div className="row between">
              <span className="row">
                <Icon name="inbox" size={22} />
                <strong>Mensajes de OTAs por correo</strong>
              </span>
              <span className={`cx-pill ${state.inbox && mailReady && lastMessage ? "ok" : "warn"}`}>
                {!mailReady ? "Resend sin conectar" : !state.inbox ? "Sin conectar" : lastMessage ? "Recibiendo" : "Esperando el primer correo"}
              </span>
            </div>
            <ul className="ota-verify">
              <li className={mailReady ? "is-ok" : "is-bad"}>
                <span>{mailReady ? <Icon name="check" size={13} /> : <Icon name="warning" size={13} />}</span>
                {mailReady ? `Resend conectado (@${state.mail.domain})` : "Conecta Resend desde el asistente (un solo paso)"}
              </li>
              <li className={lastMessage ? "is-ok" : "is-bad"}>
                <span>{lastMessage ? <Icon name="check" size={13} /> : <Icon name="warning" size={13} />}</span>
                {lastMessage ? `Último mensaje recibido ${timeAgo(lastMessage.receivedAt)}` : "Aún no llega ningún mensaje de una OTA"}
              </li>
            </ul>
            {state.inbox?.address && <small className="muted">Dirección de reenvío: {state.inbox.address}</small>}
            <div className="row wrap">
              <button type="button" className="button secondary" onClick={() => setMessages(true)}>
                {state.inbox ? "Abrir asistente" : "Conectar mensajes"}
              </button>
            </div>
          </div>
        </>
      )}
      {manage && !state && !error && (
        <p className="ota-inline" role="status">
          <Icon name="spinner" size={16} /> Comprobando conexiones…
        </p>
      )}
      {manage && <IcalPanel />}
      {calendar && (
        <CalendarAssistant
          initialUnitId={calendar.unitId}
          initialProvider={calendar.provider}
          onClose={() => {
            setCalendar(null);
            void refresh();
          }}
        />
      )}
      {messages && (
        <MessageAssistant
          onClose={() => {
            setMessages(false);
            void refresh();
          }}
        />
      )}
    </>
  );
}

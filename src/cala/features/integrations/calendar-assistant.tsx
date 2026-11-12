"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon, Modal } from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import { shortDate, dateTime } from "@/cala/lib/format";
import {
  connector,
  looksLikeBrowser,
  otaGuides,
  otaOrder,
  timeAgo,
  useConnectorState,
  type ConnectorProvider,
} from "./connectors";

type Inspect = {
  ok: true;
  detected: ConnectorProvider | null;
  total: number;
  upcoming: number;
  sample: { arrival: string; departure: string; summary: string }[];
};
type SyncResult = {
  ok: boolean;
  error?: string;
  active?: number;
  created?: number;
  updated?: number;
  released?: number;
  conflicts?: { code: string; arrival: string; departure: string; source: string }[];
};
const steps = ["Qué conectar", "Calendario de la OTA", "Importar", "Calendario de CALA", "Listo"] as const;

export function OtaMark({ provider, size = "md" }: { provider: ConnectorProvider; size?: "sm" | "md" }) {
  const g = otaGuides[provider];
  return (
    <span className={`ota-mark ota-mark-${size}`} style={{ "--ota-hue": g.hue } as CSSProperties} aria-hidden="true">
      {g.mark}
    </span>
  );
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Real two-way iCal connection for one unit and one OTA, verified at each step. */
export function CalendarAssistant({
  initialUnitId,
  initialProvider,
  onClose,
}: {
  initialUnitId?: string;
  initialProvider?: ConnectorProvider;
  onClose: () => void;
}) {
  const { data, can } = useWorkspace();
  const propertyId = data.currentPropertyId;
  const units = data.units.filter(
    (u) =>
      u.propertyId === propertyId &&
      u.active &&
      data.inventoryTypes.some((t) => t.id === u.inventoryTypeId && t.active),
  );
  const [unitId, setUnitId] = useState(initialUnitId ?? units[0]?.id ?? "");
  const [provider, setProvider] = useState<ConnectorProvider>(initialProvider ?? "airbnb");
  const [step, setStep] = useState(initialUnitId && initialProvider ? 1 : 0);
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [inspectError, setInspectError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [error, setError] = useState("");
  const [exportInfo, setExportInfo] = useState<{ url: string; events: number; shownAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const { state, refresh } = useConnectorState(propertyId, step === 3 ? 5000 : 0);
  const checkSeq = useRef(0);
  const guide = otaGuides[provider];
  const unit = units.find((u) => u.id === unitId);
  const link = state?.links.find((l) => l.unitId === unitId && l.provider === provider);
  const feed = state?.feeds.find((f) => f.unitId === unitId && f.provider === provider);
  const fetchedByOta =
    feed?.lastFetchedAt && !looksLikeBrowser(feed.agent) ? feed.lastFetchedAt : null;
  const proofSinceShown =
    fetchedByOta && exportInfo && fetchedByOta >= exportInfo.shownAt ? fetchedByOta : null;

  // ---- live validation of the pasted link, on every change ----------------
  const trimmed = url.trim();
  const format = (() => {
    if (!trimmed) return { ok: false, message: "" };
    let parsed: URL;
    try {
      parsed = new URL(trimmed.replace(/^webcal:/i, "https:"));
    } catch {
      return { ok: false, message: "Eso no parece un enlace completo. Debe empezar por https://" };
    }
    if (parsed.protocol !== "https:") return { ok: false, message: "El enlace debe empezar por https://" };
    if (/\/api\/cala\/ical/.test(parsed.pathname) || parsed.host === window.location.host)
      return { ok: false, message: "Ese es el enlace de CALA. Aquí va el enlace que te da la OTA al «Exportar calendario»." };
    return { ok: true, message: "" };
  })();
  const detectedFromUrl = (() => {
    try {
      const host = new URL(trimmed).hostname;
      if (/airbnb\./.test(host)) return "airbnb";
      if (/booking\.com$/.test(host)) return "booking";
      if (/(vrbo|homeaway)\./.test(host)) return "vrbo";
      if (/expedia/.test(host)) return "expedia";
    } catch {
      /* not a URL yet */
    }
    return null;
  })() as ConnectorProvider | null;
  const mismatch = detectedFromUrl && provider !== "other" && detectedFromUrl !== provider ? detectedFromUrl : null;

  useEffect(() => {
    setInspect(null);
    setInspectError("");
    if (!format.ok || step !== 1) return;
    const seq = ++checkSeq.current;
    const t = window.setTimeout(async () => {
      setChecking(true);
      try {
        const r = await connector<Inspect>("calendar.inspect", { propertyId, url: trimmed });
        if (seq === checkSeq.current) setInspect(r);
      } catch (e) {
        if (seq === checkSeq.current) setInspectError(e instanceof Error ? e.message : "No se pudo comprobar.");
      } finally {
        if (seq === checkSeq.current) setChecking(false);
      }
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, step, propertyId]);

  const overlaps = inspect
    ? data.reservations.filter(
        (r) =>
          r.propertyId === propertyId &&
          r.unitId === unitId &&
          !["cancelled", "no_show", "draft"].includes(r.status) &&
          inspect.sample.some((s) => r.arrival < s.departure && r.departure > s.arrival),
      )
    : [];

  async function connect() {
    setBusy(true);
    setError("");
    setSync(null);
    try {
      const r = await connector<SyncResult>("calendar.connect", { propertyId, unitId, provider, url: trimmed });
      setSync(r);
      await refresh();
      if (!r.ok) setError(r.error ?? "No pudimos importar el calendario.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos conectar el calendario.");
    } finally {
      setBusy(false);
    }
  }
  async function loadExport(rotate = false) {
    setBusy(true);
    setError("");
    try {
      const r = await connector<{ url: string; events: number }>("calendar.export", { propertyId, unitId, provider, rotate });
      setExportInfo({ ...r, shownAt: new Date(Date.now() - 1000).toISOString() });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos crear el enlace de CALA.");
    } finally {
      setBusy(false);
    }
  }
  function go(next: number) {
    setError("");
    setStep(next);
    if (next === 3 && !exportInfo) void loadExport();
  }

  if (!can("channel.manage"))
    return (
      <Modal title="Asistente de calendarios" onClose={onClose}>
        <p>Conectar calendarios requiere el permiso «Gestionar canales». Pide a un administrador que lo haga.</p>
      </Modal>
    );

  const canNext = [Boolean(unit), Boolean(inspect && !mismatch), Boolean(sync?.ok), true, true][step];

  return (
    <Modal title="Asistente de calendarios" onClose={onClose} wide>
      <div className="ota">
        <ol className="ota-steps" aria-label="Progreso">
          {steps.map((label, i) => (
            <li key={label} className={`${i === step ? "is-current" : ""}${i < step ? " is-done" : ""}`} aria-current={i === step ? "step" : undefined}>
              <span>{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
              <small>{label}</small>
            </li>
          ))}
        </ol>
        <div className="ota-progress" style={{ width: `${(step / (steps.length - 1)) * 100}%` }} aria-hidden="true" />
        <section className="ota-body ota-fwd" key={step}>
          {step === 0 && (
            <>
              <h3>¿Qué calendario quieres sincronizar?</h3>
              <p className="muted">
                Cada habitación o casa se conecta por separado con cada OTA. Así, una reserva en la OTA bloquea esa fecha en CALA, y una reserva en CALA la bloquea en la OTA.
              </p>
              {!units.length && <p className="notice warning">Primero crea una habitación o casa en Inventario.</p>}
              <label className="field">
                <span>Habitación o casa</span>
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ota-grid">
                {otaOrder.map((p) => {
                  const l = state?.links.find((x) => x.unitId === unitId && x.provider === p);
                  const f = state?.feeds.find((x) => x.unitId === unitId && x.provider === p);
                  const status = !l
                    ? "Sin conectar"
                    : l.status === "error"
                      ? "Error al leer · revisar"
                      : f?.lastFetchedAt
                        ? "Conectado en ambos sentidos"
                        : "Falta pegar el enlace de CALA";
                  return (
                    <button
                      type="button"
                      key={p}
                      className={`ota-card${provider === p ? " is-selected" : ""}`}
                      aria-pressed={provider === p}
                      onClick={() => setProvider(p)}
                    >
                      <OtaMark provider={p} />
                      <strong>{otaGuides[p].label}</strong>
                      <small>{status}</small>
                    </button>
                  );
                })}
              </div>
              {otaGuides[provider].note && <p className="notice">{otaGuides[provider].note}</p>}
            </>
          )}
          {step === 1 && (
            <>
              <h3>
                Copia el calendario de {guide.label} para «{unit?.name}»
              </h3>
              <ol className="cx-steps">
                {guide.exportSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              {guide.portal && (
                <a className="button secondary" href={guide.portal} target="_blank" rel="noreferrer">
                  <Icon name="external-link" size={16} />
                  Abrir {guide.label}
                </a>
              )}
              <label className="field">
                <span>Enlace de exportación de {guide.label}</span>
                <input
                  autoFocus
                  inputMode="url"
                  spellCheck={false}
                  value={url}
                  placeholder={guide.urlExample}
                  aria-invalid={Boolean(trimmed) && !format.ok}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </label>
              {link && !trimmed && (
                <p className="ota-inline ok">
                  <Icon name="success-circle" size={16} />
                  Ya hay un calendario conectado ({link.host}). Pega uno nuevo solo si quieres reemplazarlo.
                </p>
              )}
              {format.message && (
                <p className="ota-inline bad" role="alert">
                  <Icon name="warning" size={16} />
                  {format.message}
                </p>
              )}
              {mismatch && (
                <div className="notice warning" role="alert">
                  <p>
                    Este enlace es de {otaGuides[mismatch].label}, no de {guide.label}.
                  </p>
                  <button type="button" className="button secondary" onClick={() => setProvider(mismatch)}>
                    Es de {otaGuides[mismatch].label}, cambiar
                  </button>
                </div>
              )}
              {checking && (
                <p className="ota-inline" role="status">
                  <Icon name="spinner" size={16} />
                  Descargando el calendario para comprobarlo…
                </p>
              )}
              {inspectError && (
                <p className="notice error" role="alert">
                  {inspectError}
                </p>
              )}
              {inspect && (
                <div className="notice success" role="status">
                  <p>
                    <strong>Calendario válido.</strong>{" "}
                    {inspect.upcoming
                      ? `Tiene ${inspect.upcoming} ${inspect.upcoming === 1 ? "fecha ocupada próxima" : "fechas ocupadas próximas"}:`
                      : "No tiene fechas ocupadas próximas (es normal si aún no hay reservas)."}
                  </p>
                  {inspect.sample.length > 0 && (
                    <ul className="cx-dates">
                      {inspect.sample.map((s) => (
                        <li key={s.arrival + s.departure}>
                          {shortDate(s.arrival)} → {shortDate(s.departure)}
                          {s.summary && <small> · {s.summary}</small>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {overlaps.length > 0 && (
                    <p className="ota-inline bad">
                      <Icon name="warning" size={16} />
                      {overlaps.length === 1
                        ? `Coincide con la reserva ${overlaps[0].confirmationCode} de CALA. Revisa que no sea una sobreventa.`
                        : `Coincide con ${overlaps.length} reservas de CALA. Revisa que no sean sobreventas.`}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <h3>Importar a CALA</h3>
              <p className="muted">
                CALA guardará el enlace y bloqueará en «{unit?.name}» cada fecha ocupada en {guide.label}. Después revisa el calendario de forma automática; si {guide.label} cancela una reserva, la fecha se libera.
              </p>
              {!sync && (
                <button type="button" className="button primary" disabled={busy} onClick={() => void connect()}>
                  {busy ? <Icon name="spinner" size={16} /> : <Icon name="cloud-import" size={16} />}
                  {busy ? "Importando…" : "Conectar e importar ahora"}
                </button>
              )}
              {sync?.ok && (
                <ul className="ota-verify">
                  <li className="is-ok">
                    <span><Icon name="check" size={13} /></span>
                    Enlace guardado y leído correctamente
                  </li>
                  <li className="is-ok">
                    <span><Icon name="check" size={13} /></span>
                    {sync.active
                      ? `${sync.active} ${sync.active === 1 ? "fecha bloqueada" : "fechas bloqueadas"} en CALA (${sync.created ?? 0} nuevas)`
                      : "Sin fechas ocupadas que bloquear por ahora"}
                  </li>
                  <li className={sync.conflicts?.length ? "is-bad" : "is-ok"}>
                    <span>{sync.conflicts?.length ? <Icon name="warning" size={13} /> : <Icon name="check" size={13} />}</span>
                    {sync.conflicts?.length
                      ? `Atención: ${sync.conflicts.length} ${sync.conflicts.length === 1 ? "reserva de CALA coincide" : "reservas de CALA coinciden"} con fechas de ${guide.label}: ${sync.conflicts.map((c) => `${c.code} (${shortDate(c.arrival)})`).join(", ")}`
                      : "Sin choques con reservas de CALA"}
                  </li>
                </ul>
              )}
              {error && (
                <div className="notice error" role="alert">
                  <p>{error}</p>
                  <button type="button" className="button secondary" disabled={busy} onClick={() => void connect()}>
                    Reintentar
                  </button>
                </div>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <h3>Ahora al revés: CALA → {guide.label}</h3>
              <p className="muted">
                Este enlace es solo para {guide.label} y «{unit?.name}». Contiene tus reservas de CALA y de otras OTAs (sin nombres ni precios).
              </p>
              {exportInfo ? (
                <>
                  <div className="cx-copy">
                    <input readOnly value={exportInfo.url} aria-label="Enlace de CALA" onFocus={(e) => e.currentTarget.select()} />
                    <button
                      type="button"
                      className="button primary"
                      onClick={async () => {
                        setCopied(await copyText(exportInfo.url));
                        window.setTimeout(() => setCopied(false), 2500);
                      }}
                    >
                      <Icon name={copied ? "check" : "copy"} size={16} />
                      {copied ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <p className="ota-inline ok">
                    <Icon name="success-circle" size={16} />
                    Comprobado: el enlace responde con {exportInfo.events} {exportInfo.events === 1 ? "fecha ocupada" : "fechas ocupadas"}.
                  </p>
                  <ol className="cx-steps">
                    {guide.importSteps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <ul className="ota-verify" aria-live="polite">
                    <li className={proofSinceShown || fetchedByOta ? "is-ok" : "is-running"}>
                      <span>{proofSinceShown || fetchedByOta ? <Icon name="check" size={13} /> : <i />}</span>
                      {proofSinceShown || fetchedByOta
                        ? `${guide.label} leyó tu calendario de CALA ${timeAgo(proofSinceShown ?? fetchedByOta)} (${dateTime(proofSinceShown ?? fetchedByOta!)}).`
                        : `Esperando a que ${guide.label} lea el enlace… En cuanto lo pegues e importes, lo verás aquí.`}
                    </li>
                  </ul>
                  {feed?.lastFetchedAt && looksLikeBrowser(feed.agent) && !fetchedByOta && (
                    <p className="ota-inline bad">
                      <Icon name="info" size={16} />
                      El enlace se abrió desde un navegador, no desde {guide.label}. Pégalo dentro de {guide.label}.
                    </p>
                  )}
                  <details className="cx-more">
                    <summary>¿Lo pegaste mal o lo compartiste por error?</summary>
                    <p className="muted">Genera un enlace nuevo; el anterior dejará de funcionar y tendrás que pegar el nuevo en {guide.label}.</p>
                    <button type="button" className="button secondary" disabled={busy} onClick={() => void loadExport(true)}>
                      Generar enlace nuevo
                    </button>
                  </details>
                </>
              ) : (
                <p className="ota-inline" role="status">
                  <Icon name="spinner" size={16} />
                  Preparando y comprobando tu enlace…
                </p>
              )}
              {error && (
                <div className="notice error" role="alert">
                  <p>{error}</p>
                  <button type="button" className="button secondary" disabled={busy} onClick={() => void loadExport()}>
                    Reintentar
                  </button>
                </div>
              )}
            </>
          )}
          {step === 4 && (
            <div className="ota-done">
              <span className="ota-done-mark" aria-hidden="true">
                <Icon name={fetchedByOta ? "check" : "sync"} size={34} />
              </span>
              <h3>
                {fetchedByOta ? `«${unit?.name}» y ${guide.label} están sincronizados` : `Casi listo con ${guide.label}`}
              </h3>
              <ul className="ota-verify cx-final">
                <li className={link?.status === "ok" ? "is-ok" : "is-bad"}>
                  <span>{link?.status === "ok" ? <Icon name="check" size={13} /> : <Icon name="warning" size={13} />}</span>
                  {link?.status === "ok"
                    ? `${guide.label} → CALA: ${link.blockCount} fechas bloqueadas · leído ${timeAgo(link.lastSyncAt)}`
                    : `${guide.label} → CALA: ${link?.lastError ?? "sin conectar"}`}
                </li>
                <li className={fetchedByOta ? "is-ok" : "is-bad"}>
                  <span>{fetchedByOta ? <Icon name="check" size={13} /> : <Icon name="warning" size={13} />}</span>
                  {fetchedByOta
                    ? `CALA → ${guide.label}: ${guide.label} lee tu calendario (última vez ${timeAgo(fetchedByOta)})`
                    : `CALA → ${guide.label}: aún no confirmado. Pega el enlace de CALA en ${guide.label}; el estado aparecerá en Canales.`}
                </li>
              </ul>
              <p className="muted">
                CALA revisa los calendarios cada pocos minutos. {guide.label} suele actualizar su lectura cada 1–3 horas, así que un cambio en CALA puede tardar en aparecer allí.
              </p>
              <button type="button" className="button primary" onClick={onClose}>
                Terminar
              </button>
            </div>
          )}
        </section>
        {step < 4 && (
          <footer className="ota-foot">
            {step > 0 ? (
              <button type="button" className="button secondary" disabled={busy} onClick={() => go(step - 1)}>
                <Icon name="chevron-left" size={16} />
                Atrás
              </button>
            ) : (
              <span />
            )}
            <span className="row">
              {step === 3 && !fetchedByOta && (
                <button type="button" className="button secondary" onClick={() => go(4)}>
                  Lo haré después
                </button>
              )}
              {step === 1 && link && !trimmed && (
                <button type="button" className="button secondary" onClick={() => go(3)}>
                  Mantener el actual
                </button>
              )}
              <button
                type="button"
                className="button primary"
                disabled={!canNext || busy || (step === 3 && !fetchedByOta)}
                onClick={() => go(step + 1)}
              >
                {step === 3 ? "Verificado, continuar" : "Continuar"}
                <Icon name="chevron-right" size={16} />
              </button>
            </span>
          </footer>
        )}
      </div>
    </Modal>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Empty,
  Modal,
  SectionTitle,
  fitChars,
} from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import {
  marketCsvHeader,
  marketSummary,
  parseMarketCsv,
  type MarketRow,
} from "@/cala/domain/analytics/market";
import { performance } from "@/cala/domain/analytics/performance";
import { addDays } from "@/cala/domain/shared/dates";
import { money } from "@/cala/lib/format";
import { MarketAgent } from "./market-agent";
export function Market() {
  const { data } = useWorkspace();
  return <PropertyMarket key={data.currentPropertyId} />;
}
function PropertyMarket() {
  const { data, can, command } = useWorkspace();
  const [start, setStart] = useState(data.today),
    [end, setEnd] = useState(addDays(data.today, 30));
  const [source, setSource] = useState("");
  const [market, setMarket] = useState("");
  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState(marketCsvHeader + "\n");
  const [preview, setPreview] = useState<MarketRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const property = data.properties.find((p) => p.id === data.currentPropertyId);
  const currency = property?.currency ?? "MXN";
  const rows = data.marketObservations.filter(
    (r) => r.propertyId === data.currentPropertyId,
  );
  const filtered = rows.filter(
    (r) => (!source || r.source === source) && (!market || r.market === market),
  );
  const benchmark = marketSummary(filtered, start, end, currency, data.today);
  let own: ReturnType<typeof performance> | null = null,
    rangeError = "";
  try {
    if (data.analyticsComplete === false)
      throw new Error(
        "La lectura del workspace puede estar incompleta. Configura la agregación de reportes en el servidor antes de comparar estos datos.",
      );
    own = performance(data, { propertyId: data.currentPropertyId, start, end });
  } catch (e) {
    rangeError = e instanceof Error ? e.message : "Rango inválido";
  }
  const percent = (n: number | null) =>
    n === null ? "—" : `${(n * 100).toFixed(1)}%`;
  const stale = benchmark.oldestObservation
    ? Math.round(
        (Date.parse(data.today) - Date.parse(benchmark.oldestObservation)) /
          86400000,
      ) > 30
    : false;
  const insights: string[] = [];
  if (own) {
    if (own.occupancy !== null && own.occupancy < 0.4)
      insights.push(
        "Revisa las noches vacías y la estancia mínima antes de reducir tarifas de forma general.",
      );
    if (own.directShare !== null && own.directShare < 0.25)
      insights.push(
        "La proporción de reservas directas es menor al 25%. Evalúa reforzar la venta directa y las visitas de huéspedes recurrentes.",
      );
    if (own.cancellationRate !== null && own.cancellationRate > 0.2)
      insights.push(
        "La cohorte de llegadas supera el 20% de cancelaciones. Revisa políticas y concentración por canal.",
      );
    if (
      can("finance.read") &&
      own.adrMinor !== null &&
      benchmark.adrMinor !== null &&
      !stale &&
      benchmark.dates === own.days.length &&
      BigInt(own.adrMinor) * 10n < BigInt(benchmark.adrMinor) * 9n
    )
      insights.push(
        "Tu ADR está más de 10% por debajo de la muestra importada. Comprueba comparabilidad de ubicación, categoría, impuestos y servicios antes de subir precios.",
      );
  }
  return (
    <>
      <SectionTitle
        eyebrow="ENTIENDE TU POSICIÓN"
        title="Estudio de mercado"
        description="Compara tu desempeño con observaciones de mercado cuya fuente puedes verificar."
      >
        <Link className="button secondary" href="/admin/reportes">
          Ver estadísticas
        </Link>
        {can("rates.write") && (
          <button
            className="button primary"
            onClick={() => {
              setError("");
              setPreview(null);
              setImporting(true);
            }}
          >
            Importar observaciones CSV
          </button>
        )}
      </SectionTitle>
      <MarketAgent />
      <div className="notice">
        Datos de mercado importados por tu equipo. CALA no tiene una fuente de
        mercado automática conectada. La muestra puede contener sesgos; las
        sugerencias son reglas explicables y no modifican tarifas.
      </div>
      <div className="toolbar panel analytics-filters">
        <label className="field">
          <span>Desde</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Hasta (exclusivo)</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Fuente</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Todas</option>
            {[...new Set(rows.map((r) => r.source))].sort().map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Mercado comparable</span>
          <select value={market} onChange={(e) => setMarket(e.target.value)}>
            <option value="">Todos</option>
            {[...new Set(rows.map((r) => r.market))].sort().map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
      </div>
      {rangeError && (
        <div className="notice error" role="alert">
          {rangeError}
        </div>
      )}
      {!rangeError && (
        <>
          <div className="stats analytics-stats">
            <div className="stat">
              <span>Tu ocupación</span>
              <strong style={fitChars(percent(own?.occupancy ?? null))}>
                {percent(own?.occupancy ?? null)}
              </strong>
              <small>Capacidad física, reservas confirmadas y en casa</small>
            </div>
            <div className="stat">
              <span>Ocupación de la muestra</span>
              <strong style={fitChars(percent(benchmark.occupancy))}>
                {percent(benchmark.occupancy)}
              </strong>
              <small>
                {benchmark.dates} fechas · {benchmark.observations.length}{" "}
                observaciones
              </small>
            </div>
            {can("finance.read") && (
              <div className="stat">
                <span>Tu ADR</span>
                <strong
                  style={fitChars(
                    own?.adrMinor == null ? "—" : money(own.adrMinor, currency),
                  )}
                >
                  {own?.adrMinor == null ? "—" : money(own.adrMinor, currency)}
                </strong>
                <small>Bruto por recurso-noche vendido</small>
              </div>
            )}
            <div className="stat">
              <span>ADR de la muestra</span>
              <strong
                style={fitChars(
                  benchmark.adrMinor === null
                    ? "—"
                    : money(benchmark.adrMinor, currency),
                )}
              >
                {benchmark.adrMinor === null
                  ? "—"
                  : money(benchmark.adrMinor, currency)}
              </strong>
              <small>Ponderado por tamaño de muestra</small>
            </div>
          </div>
          {stale && (
            <div className="notice">
              Hay observaciones con más de 30 días de antigüedad. Actualiza la
              muestra antes de tomar decisiones de precio.
            </div>
          )}
          <div className="panel padded">
            <h2>Oportunidades para revisar</h2>
            {insights.length ? (
              <ul className="market-insights">
                {insights.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                Aún no hay señales suficientes para sugerir acciones con estas
                reglas. Amplía el rango o agrega observaciones comparables.
              </p>
            )}
            <small className="muted">
              Reglas: ocupación &lt;40%, reservas directas &lt;25%,
              cancelaciones &gt;20%, ADR &lt;90% de la muestra vigente. Se
              requieren datos para cada condición.
            </small>
          </div>
          {benchmark.observations.length ? (
            <div
              className="panel table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Observaciones de mercado"
            >
              <table>
                <caption className="sr-only">
                  Observaciones de mercado usadas en la comparación
                </caption>
                <thead>
                  <tr>
                    <th>Noche</th>
                    <th>Fuente / mercado</th>
                    <th>Observado el</th>
                    <th>Muestra</th>
                    <th>Ocupación</th>
                    <th>ADR</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmark.observations.slice(0, 100).map((r) => (
                    <tr key={r.id}>
                      <td>{r.date}</td>
                      <td>
                        {r.source}
                        <small className="table-sub">{r.market}</small>
                      </td>
                      <td>{r.observedOn}</td>
                      <td>{r.sampleSize}</td>
                      <td>{percent(r.occupancyBps / 10000)}</td>
                      <td>{money(r.adrMinor, r.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {benchmark.observations.length > 100 && (
                <p className="muted">
                  Se muestran las primeras 100 observaciones. Las métricas
                  incluyen todas las observaciones del rango.
                </p>
              )}
            </div>
          ) : (
            <Empty
              title="Sin datos de mercado para comparar"
              description="Importa un CSV con datos que tengas derecho a usar y elige el rango correspondiente."
            />
          )}
          <details className="panel padded">
            <summary>Definiciones y comparabilidad</summary>
            <p>
              ADR en centavos de {currency}, con la misma base de impuestos que
              tus estadísticas. Ocupación en puntos base: 6500 equivale a 65%.
              Cada fila representa una noche y una muestra de alojamientos
              comparables. Se usa la observación más reciente por fuente,
              mercado y noche; nunca se mezclan monedas. El tamaño de muestra
              pondera las métricas. Evita mezclar fuentes que midan los mismos
              alojamientos.
            </p>
            <p>
              La muestra puede cubrir solo parte de tu período. Compara fechas
              equivalentes y el mismo recurso vendible: una cama y una
              habitación no son comparables. Estos indicadores no equivalen a un
              motor predictivo ni a un precio de venta recomendado.
            </p>
          </details>
        </>
      )}
      {importing && (
        <Modal
          title="Importar datos de mercado"
          onClose={() => {
            if (!busy) setImporting(false);
          }}
          wide
        >
          <p>
            Hasta 366 filas por lote. Usa enteros: adrMinor en centavos;
            occupancyBps de 0 a 10000. La observación no puede ser futura. Una
            fila repetida en otro lote actualiza la misma observación.
          </p>
          <label className="field">
            <span>Archivo CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={async (e) => {
                setError("");
                setPreview(null);
                try {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 100000)
                    throw Error("El CSV no puede superar 100 KB.");
                  setCsv(await file.text());
                } catch (e) {
                  setError(e instanceof Error ? e.message : "No se pudo leer.");
                }
              }}
            />
          </label>
          <label className="field">
            <span>Contenido CSV</span>
            <textarea
              rows={8}
              value={csv}
              disabled={busy}
              onChange={(e) => {
                setCsv(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <div className="row">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setError("");
                try {
                  const parsed = parseMarketCsv(csv);
                  if (parsed.some((r) => r.currency !== currency))
                    throw Error(`La moneda debe ser ${currency}.`);
                  if (parsed.some((r) => r.observedOn > data.today))
                    throw Error("La observación no puede ser futura.");
                  setPreview(parsed);
                } catch (e) {
                  setPreview(null);
                  setError(e instanceof Error ? e.message : "CSV inválido.");
                }
              }}
            >
              Validar y previsualizar
            </button>
            {preview && (
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await command({ type: "market.import", rows: preview });
                    setImporting(false);
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "No se pudo importar.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy
                  ? "Importando…"
                  : `Importar ${preview.length} observaciones`}
              </button>
            )}
          </div>
          {preview && (
            <div className="notice">
              {preview.length} filas válidas · {preview[0].source} ·{" "}
              {preview[0].market} · {preview[0].currency}. Revisa el contenido
              antes de importar.
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

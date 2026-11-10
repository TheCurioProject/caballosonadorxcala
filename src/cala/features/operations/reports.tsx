"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/cala/features/workspace/context";
import {
  SectionTitle,
  Empty,
  Icon,
  fitChars,
} from "@/cala/components/ui/primitives";
import { addDays } from "@/cala/domain/shared/dates";
import {
  performance,
  performanceCsv,
} from "@/cala/domain/analytics/performance";
import { money } from "@/cala/lib/format";
import { ChannelCharts } from "./channel-charts";

export function Reports() {
  const { data } = useWorkspace();
  return <PropertyReports key={data.currentPropertyId} />;
}
function PropertyReports() {
  const { data, can } = useWorkspace();
  const [start, setStart] = useState(data.today),
    [end, setEnd] = useState(addDays(data.today, 30));
  const [source, setSource] = useState("");
  const [inventoryTypeId, setInventoryTypeId] = useState("");
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState<"charts" | "tables">("charts");
  const property = data.properties.find((p) => p.id === data.currentPropertyId);
  const currency = property?.currency ?? "MXN";
  const finance = can("finance.read");
  const computed = useMemo(() => {
    try {
      if (data.analyticsComplete === false)
        throw new Error(
          "El workspace alcanzó el límite de lectura del servidor. Las estadísticas se han detenido para evitar resultados incompletos; configura la agregación de reportes en el servidor.",
        );
      const filter = {
        propertyId: data.currentPropertyId,
        start,
        end,
        source,
        inventoryTypeId,
        includePending: pending,
      };
      const current = performance(data, filter);
      const duration = current.days.length;
      const previous = performance(data, {
        ...filter,
        start: addDays(start, -duration),
        end: start,
      });
      return { current, previous, error: "" };
    } catch (e) {
      return {
        current: null,
        previous: null,
        error: e instanceof Error ? e.message : "Elige un rango válido.",
      };
    }
  }, [data, start, end, source, inventoryTypeId, pending]);
  const report = computed.current,
    prev = computed.previous;
  const percent = (n: number | null) =>
    n === null ? "—" : `${(n * 100).toFixed(1)}%`;
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([performanceCsv(report, currency, finance)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `cala-estadisticas-${start}-${end}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const delta = (now: number | null, before: number | null, suffix = "") =>
    now === null || before === null
      ? "Sin base de comparación"
      : `${now - before >= 0 ? "+" : ""}${(now - before).toFixed(1)}${suffix} vs. período anterior`;
  return (
    <>
      <SectionTitle
        eyebrow="INFORMACIÓN PARA DECIDIR"
        title="Estadísticas y reportes"
        description="Cada noche en su período. Compara tu desempeño y encuentra oportunidades."
      >
        <button
          className="button secondary"
          disabled={!report}
          onClick={download}
        >
          <Icon name="download" />
          Descargar CSV
        </button>
        <Link className="button primary" href="/admin/mercado">
          Estudio de mercado
        </Link>
      </SectionTitle>
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
          <span>Canal</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Todos los canales</option>
            {[
              ...new Set(
                data.reservations
                  .filter((r) => r.propertyId === data.currentPropertyId)
                  .map((r) => r.source),
              ),
            ]
              .sort()
              .map((v) => (
                <option value={v} key={v}>
                  {v}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span>Inventario</span>
          <select
            value={inventoryTypeId}
            onChange={(e) => setInventoryTypeId(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {data.inventoryTypes
              .filter((i) => i.propertyId === data.currentPropertyId)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={pending}
            onChange={(e) => setPending(e.target.checked)}
          />
          Incluir pendientes
        </label>
      </div>
      {computed.error && (
        <div className="notice error" role="alert">
          {computed.error}
        </div>
      )}
      {report && (
        <>
          <div className="stats analytics-stats">
            <Metric
              label="Ocupación física"
              value={percent(report.occupancy)}
              detail={delta(
                report.occupancy === null ? null : report.occupancy * 100,
                prev?.occupancy === null || !prev ? null : prev.occupancy * 100,
                " pp",
              )}
            />
            <Metric
              label="Recursos-noche vendidos"
              value={String(report.sold)}
              detail={`${report.capacity} disponibles · ${report.blocked} bloqueados`}
            />
            {finance && (
              <Metric
                label="Alojamiento bruto"
                value={money(report.roomRevenueMinor, currency)}
                detail="Importe acordado, impuestos incluidos; prorrateado por noche"
              />
            )}
            {finance && (
              <Metric
                label="ADR por recurso"
                value={
                  report.adrMinor === null
                    ? "—"
                    : money(report.adrMinor, currency)
                }
                detail="Alojamiento bruto / recursos-noche vendidos"
              />
            )}
            {finance && (
              <Metric
                label="RevPAR por recurso"
                value={
                  report.revparMinor === null
                    ? "—"
                    : money(report.revparMinor, currency)
                }
                detail="Alojamiento bruto / capacidad física del período"
              />
            )}
            <Metric
              label="Estancias en el período"
              value={String(report.bookings)}
              detail={`${report.cancellations} canceladas de la cohorte de llegadas`}
            />
            <Metric
              label="Anticipación media"
              value={
                report.averageLeadDays === null
                  ? "—"
                  : `${report.averageLeadDays.toFixed(1)} días`
              }
              detail="Entre fecha de reserva y llegada"
            />
            <Metric
              label="Duración media"
              value={
                report.averageStayNights === null
                  ? "—"
                  : `${report.averageStayNights.toFixed(1)} noches`
              }
              detail="Duración completa de las estancias que intersectan"
            />
            <Metric
              label="Reservas directas"
              value={percent(report.directShare)}
              detail="Reservas directas o web / estancias del período"
            />
            <Metric
              label="Cancelaciones"
              value={percent(report.cancellationRate)}
              detail="Canceladas / reservas con llegada en el período"
            />
          </div>
          <div className="tabs" aria-label="Vista de estadísticas">
            <button
              className={tab === "charts" ? "active" : ""}
              aria-pressed={tab === "charts"}
              onClick={() => setTab("charts")}
            >
              Gráficas
            </button>
            <button
              className={tab === "tables" ? "active" : ""}
              aria-pressed={tab === "tables"}
              onClick={() => setTab("tables")}
            >
              Tablas
            </button>
          </div>
          {tab === "charts" ? (
            <div className="panel padded">
              <h2>Ocupación por día</h2>
              <p className="muted">
                Período actual en Pacific · período anterior en Stone
              </p>
              <div
                className="performance-chart"
                tabIndex={0}
                role="img"
                aria-label={`Ocupación física del período: ${percent(report.occupancy)}. Detalle disponible en la vista Tablas.`}
              >
                {report.days.map((d, index) => (
                  <div
                    className="performance-column"
                    key={d.date}
                    title={`${d.date}: ${d.occupied}/${d.capacity}; bloqueados: ${d.blocked}`}
                  >
                    <small>{d.occupied}</small>
                    <div className="performance-bars">
                      <i
                        style={{
                          height: `${d.capacity ? (d.occupied / d.capacity) * 100 : 0}%`,
                        }}
                      />
                      <i
                        className="previous"
                        style={{
                          height: `${prev?.days[index]?.capacity ? (prev.days[index].occupied / prev.days[index].capacity) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <small>{d.date.slice(8)}</small>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="panel table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Detalle de estadísticas"
            >
              <table>
                <caption className="sr-only">
                  Ocupación e ingresos por día
                </caption>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Capacidad</th>
                    <th>Bloqueados</th>
                    <th>Vendidos</th>
                    {finance && <th>Alojamiento bruto</th>}
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{d.capacity}</td>
                      <td>{d.blocked}</td>
                      <td>{d.occupied}</td>
                      {finance && (
                        <td>{money(d.roomRevenueMinor, currency)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="panel padded">
            <h2>Rendimiento por canal</h2>
            {tab === "charts" && (
              <ChannelCharts
                report={report}
                currency={currency}
                finance={finance}
              />
            )}
            {report.channels.length ? (
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Detalle de estadísticas"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Canal</th>
                      <th>Reservas</th>
                      <th>Noches de estancia</th>
                      {finance && <th>Alojamiento bruto</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {report.channels.map((c) => (
                      <tr key={c.source}>
                        <td>{c.source}</td>
                        <td>{c.bookings}</td>
                        <td>{c.nights}</td>
                        {finance && <td>{money(c.revenueMinor, currency)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="Sin estancias en este período"
                description="Amplía el rango o revisa los filtros para encontrar tus reservas."
              />
            )}
          </div>
          <details className="panel padded">
            <summary>Cómo se calculan estas métricas</summary>
            <p>
              Las fechas son de estancia: la salida es exclusiva. Se cuentan
              recursos físicos finales: una habitación con camas vendibles
              aporta las camas, sin sumar de nuevo la habitación. Los bloqueos
              permanecen en el denominador de ocupación física. Ocupación sobre
              capacidad vendible: {percent(report.sellableOccupancy)}.
            </p>
            <p>
              Los importes son alojamiento bruto con impuestos, repartidos entre
              las noches de estancia con asignación exacta de centavos. Se
              excluyen cargos extra, comisiones, pagos y cancelaciones. ADR y
              RevPAR siguen esa misma base. La comparación usa el período
              inmediatamente anterior de igual duración; los filtros se
              mantienen. Sin datos se muestra —.
            </p>
            <p>
              Filtrar por canal muestra su contribución sobre la capacidad
              total. Las cancelaciones se calculan por fecha de llegada
              prevista, no por fecha de cancelación. Una observación de mercado
              debe usar la misma base de impuestos y recursos para ser
              comparable.
            </p>
          </details>
        </>
      )}
    </>
  );
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="stat">
      <span className="muted">{label}</span>
      <strong style={fitChars(value)}>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

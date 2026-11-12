"use client";
import { useMemo, useState } from "react";
import { useWorkspace } from "@/cala/features/workspace/context";
import { useI18n } from "@/cala/lib/i18n";
import { Icon, Empty, fitChars } from "@/cala/components/ui/primitives";
import { money, shortDate, uiLocale } from "@/cala/lib/format";
import {
  financeCsv,
  financeOverview,
  type FinanceBucket,
} from "@/cala/domain/analytics/finance";
import { Distribution } from "@/cala/features/operations/channel-charts";

const monthStart = (date: string, offset: number) => {
  const [y, m] = date.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return d.toISOString().slice(0, 10);
};
const pct = (n: number | null) =>
  n === null ? "—" : `${(n * 100).toFixed(1)}%`;

function bucketLabel(b: FinanceBucket, granularity: "month" | "year") {
  if (granularity === "year") return b.key;
  return new Intl.DateTimeFormat(uiLocale(), {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(b.key + "-15T12:00:00Z"));
}

/** Finance → Overview: Smoobu-style analytics plus collections and balances. */
export function FinanceOverview({
  onOpenReservation,
}: {
  onOpenReservation: (id: string) => void;
}) {
  const { data } = useWorkspace();
  const { t } = useI18n();
  const [granularity, setGranularity] = useState<"month" | "year">("month");
  const [from, setFrom] = useState(monthStart(data.today, -3).slice(0, 7));
  const [to, setTo] = useState(monthStart(data.today, 3).slice(0, 7));
  const [scope, setScope] = useState("all");
  const [pending, setPending] = useState(false);
  const [view, setView] = useState<"charts" | "tables">("charts");
  const properties = data.properties;
  const computed = useMemo(() => {
    try {
      const [propertyId, inventoryTypeId] =
        scope === "all" ? ["", ""] : scope.split(":");
      const start =
        granularity === "year" ? from.slice(0, 4) + "-01-01" : from + "-01";
      const end =
        granularity === "year"
          ? `${Number(to.slice(0, 4)) + 1}-01-01`
          : monthStart(to + "-01", 1);
      const report = financeOverview(data, {
        propertyIds: propertyId ? [propertyId] : properties.map((p) => p.id),
        inventoryTypeId: inventoryTypeId || undefined,
        start,
        end,
        granularity,
        includePending: pending,
      });
      return { report, start, end, error: "" };
    } catch (e) {
      return {
        report: null,
        start: "",
        end: "",
        error: e instanceof Error ? e.message : "Elige un rango válido.",
      };
    }
  }, [data, scope, from, to, granularity, pending, properties]);
  const report = computed.report;
  const selectedProperty =
    scope === "all"
      ? properties[0]
      : properties.find((p) => p.id === scope.split(":")[0]);
  const currency = selectedProperty?.currency ?? "MXN";
  const mixedCurrency =
    scope === "all" && new Set(properties.map((p) => p.currency)).size > 1;
  const fmt = (n: number) => money(n, currency);
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([financeCsv(report, currency)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `cala-finanzas-${computed.start}-${computed.end}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const labels = report?.buckets.map((b) => bucketLabel(b, granularity)) ?? [];
  return (
    <div className="finance-overview">
      <div className="toolbar panel analytics-filters finance-filters">
        <div className="segmented" role="group" aria-label={t("Agrupar por")}>
          {(["month", "year"] as const).map((g) => (
            <button
              key={g}
              className={granularity === g ? "active" : ""}
              aria-pressed={granularity === g}
              onClick={() => setGranularity(g)}
            >
              {g === "month" ? t("Mensual") : t("Anual")}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{t("Desde")}</span>
          {granularity === "month" ? (
            <input
              type="month"
              value={from}
              onChange={(e) => e.target.value && setFrom(e.target.value)}
            />
          ) : (
            <input
              type="number"
              min={2000}
              max={2100}
              value={from.slice(0, 4)}
              onChange={(e) =>
                e.target.value.length === 4 &&
                setFrom(e.target.value + from.slice(4))
              }
            />
          )}
        </label>
        <label className="field">
          <span>{t("Hasta")}</span>
          {granularity === "month" ? (
            <input
              type="month"
              value={to}
              onChange={(e) => e.target.value && setTo(e.target.value)}
            />
          ) : (
            <input
              type="number"
              min={2000}
              max={2100}
              value={to.slice(0, 4)}
              onChange={(e) =>
                e.target.value.length === 4 && setTo(e.target.value + to.slice(4))
              }
            />
          )}
        </label>
        <label className="field finance-scope">
          <span>{t("Alojamiento")}</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">
              {t("Todas las propiedades")} ({properties.length})
            </option>
            {properties.map((p) => (
              <optgroup key={p.id} label={p.name}>
                <option value={p.id + ":"}>
                  {p.name} · {t("completa")}
                </option>
                {data.inventoryTypes
                  .filter((i) => i.propertyId === p.id)
                  .map((i) => (
                    <option key={i.id} value={p.id + ":" + i.id}>
                      ↳ {i.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={pending}
            onChange={(e) => setPending(e.target.checked)}
          />
          {t("Incluir pendientes")}
        </label>
        <button
          className="button secondary"
          disabled={!report}
          onClick={download}
        >
          <Icon name="download" />
          {t("Descargar CSV")}
        </button>
      </div>
      {computed.error && (
        <div className="notice error" role="alert">
          {t(computed.error)}
        </div>
      )}
      {mixedCurrency && (
        <div className="notice">
          {t(
            "Tus propiedades usan monedas distintas. Elige una propiedad para ver importes exactos.",
          )}
        </div>
      )}
      {report && (
        <>
          <div className="finance-kpis">
            <KpiCard
              icon="finance"
              tone="accent"
              value={fmt(report.totals.revenueMinor)}
              label={t("Ingresos")}
              detail={`${report.totals.nights} ${t("noches")}`}
              series={report.buckets.map((b) => b.revenueMinor)}
              labels={labels}
              format={fmt}
            />
            <KpiCard
              icon="reservation"
              tone="accent"
              value={String(report.totals.bookings)}
              label={t("Reservas")}
              detail={`${report.totals.bookingNights} ${t("noches")}`}
              series={report.buckets.map((b) => b.bookings)}
              labels={labels}
              format={String}
            />
            <KpiCard
              icon="cancel-reservation"
              tone="clay"
              value={String(report.totals.cancellations)}
              label={t("Cancelaciones")}
              detail={`${report.totals.cancelledNights} ${t("noches")}`}
              series={report.buckets.map((b) => b.cancellations)}
              labels={labels}
              format={String}
            />
          </div>
          <div className="stats finance-money">
            <Tile
              label={t("Cobrado en el período")}
              value={fmt(report.totals.collectedMinor)}
              detail={t("Pagos recibidos, menos reembolsos")}
            />
            <Tile
              label={t("Por cobrar")}
              value={fmt(report.totals.outstandingMinor)}
              detail={`${report.receivables.length} ${t("reservas con saldo")}`}
              warn={report.totals.outstandingMinor > 0}
            />
            <Tile
              label={t("Depósitos en garantía retenidos")}
              value={fmt(report.totals.depositsHeldMinor)}
              detail={t("No cuentan como ingreso")}
            />
            <Tile
              label="ADR"
              value={
                report.totals.adrMinor === null
                  ? "—"
                  : fmt(report.totals.adrMinor)
              }
              detail={t("Ingreso medio por noche vendida")}
            />
            <Tile
              label="RevPAR"
              value={
                report.totals.revparMinor === null
                  ? "—"
                  : fmt(report.totals.revparMinor)
              }
              detail={t("Ingreso por noche disponible")}
            />
            <Tile
              label={t("Estancia media")}
              value={
                report.totals.averageStay === null
                  ? "—"
                  : `${report.totals.averageStay.toFixed(1)} ${t("noches")}`
              }
              detail={t("Por reserva con llegada en el período")}
            />
          </div>
          <div className="finance-charts">
            <section className="panel padded finance-gauge-panel">
              <h3>{t("Ocupación")}</h3>
              <Gauge value={report.totals.occupancy} />
            </section>
            <section className="panel padded">
              <h3>{t("Ingresos por período")}</h3>
              <BarChart
                values={report.buckets.map((b) => b.revenueMinor)}
                labels={labels}
                format={fmt}
                detail={(i) =>
                  `${report.buckets[i].nights} ${t("noches")} · ${t("cobrado")} ${fmt(report.buckets[i].collectedMinor)}`
                }
              />
            </section>
            <section className="panel padded">
              <h3>{t("Ocupación por período")}</h3>
              <LineChart
                values={report.buckets.map((b) => b.occupancy)}
                labels={labels}
              />
            </section>
          </div>
          <div className="tabs" aria-label={t("Vista de finanzas")}>
            {(["charts", "tables"] as const).map((v) => (
              <button
                key={v}
                className={view === v ? "active" : ""}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {v === "charts" ? t("Gráficas") : t("Tablas")}
              </button>
            ))}
          </div>
          {view === "charts" ? (
            report.channels.length ? (
              <div className="channel-distributions">
                <Distribution
                  title={t("Ingresos por canal")}
                  entries={report.channels.map((c) => ({
                    label: c.source,
                    value: c.revenueMinor,
                  }))}
                  format={fmt}
                />
                <Distribution
                  title={t("Reservas por canal")}
                  entries={report.channels.map((c) => ({
                    label: c.source,
                    value: c.bookings,
                  }))}
                />
                <Distribution
                  title={t("Noches por canal")}
                  entries={report.channels.map((c) => ({
                    label: c.source,
                    value: c.nights,
                  }))}
                />
                <Distribution
                  title={t("Cancelaciones por canal")}
                  entries={report.channels.map((c) => ({
                    label: c.source,
                    value: c.cancellations,
                  }))}
                />
              </div>
            ) : (
              <Empty
                title="Sin estancias en este período"
                description="Amplía el rango o revisa los filtros para encontrar tus reservas."
              />
            )
          ) : (
            <div className="finance-tables">
              <div
                className="panel table-wrap"
                tabIndex={0}
                role="region"
                aria-label={t("Resumen por período")}
              >
                <table>
                  <thead>
                    <tr>
                      <th>{t("Período")}</th>
                      <th className="align-right">{t("Ingresos")}</th>
                      <th className="align-right">{t("Noches")}</th>
                      <th className="align-right">{t("Reservas")}</th>
                      <th className="align-right">{t("Cancelaciones")}</th>
                      <th className="align-right">{t("Ocupación")}</th>
                      <th className="align-right">ADR</th>
                      <th className="align-right">{t("Cobrado")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.buckets.map((b, i) => (
                      <tr key={b.key}>
                        <td>{labels[i]}</td>
                        <td className="align-right mono">{fmt(b.revenueMinor)}</td>
                        <td className="align-right">{b.nights}</td>
                        <td className="align-right">{b.bookings}</td>
                        <td className="align-right">{b.cancellations}</td>
                        <td className="align-right">{pct(b.occupancy)}</td>
                        <td className="align-right mono">
                          {b.nights ? fmt(Math.round(b.revenueMinor / b.nights)) : "—"}
                        </td>
                        <td className="align-right mono">{fmt(b.collectedMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>{t("Total")}</th>
                      <th className="align-right mono">{fmt(report.totals.revenueMinor)}</th>
                      <th className="align-right">{report.totals.nights}</th>
                      <th className="align-right">{report.totals.bookings}</th>
                      <th className="align-right">{report.totals.cancellations}</th>
                      <th className="align-right">{pct(report.totals.occupancy)}</th>
                      <th className="align-right mono">
                        {report.totals.adrMinor === null ? "—" : fmt(report.totals.adrMinor)}
                      </th>
                      <th className="align-right mono">{fmt(report.totals.collectedMinor)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div
                className="panel table-wrap"
                tabIndex={0}
                role="region"
                aria-label={t("Por propiedad")}
              >
                <table>
                  <thead>
                    <tr>
                      <th>{t("Propiedad")}</th>
                      <th className="align-right">{t("Ingresos")}</th>
                      <th className="align-right">{t("Noches")}</th>
                      <th className="align-right">{t("Reservas")}</th>
                      <th className="align-right">{t("Ocupación")}</th>
                      <th className="align-right">ADR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.properties.map((p) => (
                      <tr key={p.propertyId}>
                        <td>{p.name}</td>
                        <td className="align-right mono">{fmt(p.revenueMinor)}</td>
                        <td className="align-right">{p.nights}</td>
                        <td className="align-right">{p.bookings}</td>
                        <td className="align-right">{pct(p.occupancy)}</td>
                        <td className="align-right mono">
                          {p.adrMinor === null ? "—" : fmt(p.adrMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                className="panel table-wrap"
                tabIndex={0}
                role="region"
                aria-label={t("Por canal")}
              >
                <table>
                  <thead>
                    <tr>
                      <th>{t("Canal")}</th>
                      <th className="align-right">{t("Ingresos")}</th>
                      <th className="align-right">{t("Reservas")}</th>
                      <th className="align-right">{t("Noches")}</th>
                      <th className="align-right">{t("Cancelaciones")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.channels.map((c) => (
                      <tr key={c.source}>
                        <td>{c.source}</td>
                        <td className="align-right mono">{fmt(c.revenueMinor)}</td>
                        <td className="align-right">{c.bookings}</td>
                        <td className="align-right">{c.nights}</td>
                        <td className="align-right">{c.cancellations}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{t("Saldos pendientes")}</h2>
                <p className="muted">
                  {t("Estancias del período que aún no están pagadas por completo.")}
                </p>
              </div>
              <strong className="mono text-warning">
                {fmt(report.totals.outstandingMinor)}
              </strong>
            </div>
            {report.receivables.length ? (
              <div className="table-wrap finance-receivables">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Huésped")}</th>
                      <th>{t("Estancia")}</th>
                      <th className="align-right">{t("Total")}</th>
                      <th className="align-right">{t("Pagado")}</th>
                      <th className="align-right">{t("Saldo")}</th>
                      <th aria-label={t("Acciones")} />
                    </tr>
                  </thead>
                  <tbody>
                    {report.receivables.map((r) => (
                      <tr key={r.reservationId}>
                        <td>
                          <strong data-no-translate>{r.guest}</strong>
                          <br />
                          <small className="muted mono">{r.code}</small>
                        </td>
                        <td>
                          {shortDate(r.arrival)} → {shortDate(r.departure)}
                        </td>
                        <td className="align-right mono" data-label={t("Total")}>{fmt(r.totalMinor)}</td>
                        <td className="align-right mono" data-label={t("Pagado")}>{fmt(r.paidMinor)}</td>
                        <td className="align-right mono text-warning" data-label={t("Saldo")}>
                          {fmt(r.balanceMinor)}
                        </td>
                        <td className="align-right">
                          <button
                            className="button secondary small"
                            onClick={() => onOpenReservation(r.reservationId)}
                          >
                            {t("Registrar pago")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted padded">
                {t("Todo cobrado: no hay saldos pendientes en este período.")}
              </p>
            )}
          </section>
          <details className="panel padded">
            <summary>{t("Cómo se calculan estas cifras")}</summary>
            <p>
              {t(
                "Ingresos: lo que paga el huésped por la estancia (alojamiento y cargos extra del folio), repartido entre sus noches; una estancia que cruza meses cuenta en ambos. Reservas y cancelaciones se cuentan por fecha de llegada. Ocupación: noches vendidas entre noches disponibles de las unidades físicas.",
              )}
            </p>
            <p>
              {t(
                "Cobrado: pagos registrados con fecha dentro del período, menos reembolsos. Los depósitos en garantía se muestran aparte porque se devuelven al huésped. Por cobrar: total de la estancia menos lo pagado.",
              )}
            </p>
          </details>
        </>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  detail,
  warn = false,
}: {
  label: string;
  value: string;
  detail: string;
  warn?: boolean;
}) {
  return (
    <div className="stat">
      <span className="muted">{label}</span>
      <strong className={warn ? "text-warning" : ""} style={fitChars(value)}>
        {value}
      </strong>
      <small>{detail}</small>
    </div>
  );
}

function KpiCard({
  icon,
  tone,
  value,
  label,
  detail,
  series,
  labels,
  format,
}: {
  icon: "finance" | "reservation" | "cancel-reservation";
  tone: "accent" | "clay";
  value: string;
  label: string;
  detail: string;
  series: number[];
  labels: string[];
  format: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...series, 1);
  const w = 300,
    h = 64,
    step = series.length > 1 ? w / (series.length - 1) : 0;
  const pts = series.map(
    (v, i) => [series.length > 1 ? i * step : w / 2, h - 6 - (v / max) * (h - 14)] as const,
  );
  return (
    <section className={"panel finance-kpi tone-" + tone}>
      <div className="finance-kpi-head">
        <Icon name={icon} size={18} />
        <strong style={fitChars(value)}>{value}</strong>
        <span>{label}</span>
      </div>
      <small className="muted">{detail}</small>
      <div className="sparkline" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline
            points={pts.map((p) => p.join(",")).join(" ")}
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="sparkline-layer">
          {hover !== null && (
            <i
              className="spark-dot"
              style={{
                left: `${(pts[hover][0] / w) * 100}%`,
                top: `${(pts[hover][1] / h) * 100}%`,
              }}
            />
          )}
        </div>
        <div className="sparkline-hits">
          {series.map((v, i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              aria-label={`${labels[i]}: ${format(v)}`}
            />
          ))}
        </div>
        {hover !== null && (
          <div className="chart-tip" role="status">
            <small>{labels[hover]}</small>
            <strong>{format(series[hover])}</strong>
          </div>
        )}
      </div>
    </section>
  );
}

function Gauge({ value }: { value: number | null }) {
  const v = Math.max(0, Math.min(value ?? 0, 1));
  const r = 80,
    cx = 100,
    cy = 96;
  const point = (f: number) => {
    const a = Math.PI * (1 - f);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const [ex, ey] = point(v);
  const [nx, ny] = [cx + (r - 22) * Math.cos(Math.PI * (1 - v)), cy - (r - 22) * Math.sin(Math.PI * (1 - v))];
  return (
    <div className="finance-gauge">
      <svg viewBox="0 0 200 116" role="img" aria-label={`${pct(value)}`}>
        <path
          className="gauge-track"
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        />
        {v > 0 && (
          <path
            className="gauge-value"
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex} ${ey}`}
          />
        )}
        <line className="gauge-needle" x1={cx} y1={cy} x2={nx} y2={ny} />
        <circle className="gauge-hub" cx={cx} cy={cy} r={5} />
        <text x={cx - r} y={cy + 16} textAnchor="middle">0%</text>
        <text x={cx + r} y={cy + 16} textAnchor="middle">100%</text>
      </svg>
      <strong>{pct(value)}</strong>
    </div>
  );
}

function BarChart({
  values,
  labels,
  format,
  detail,
}: {
  values: number[];
  labels: string[];
  format: (n: number) => string;
  detail: (i: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...values, 1);
  return (
    <div className="finance-bars" onMouseLeave={() => setHover(null)}>
      <div className="finance-bars-plot">
        {values.map((v, i) => (
          <button
            key={i}
            type="button"
            className={"finance-bar" + (hover === i ? " active" : "")}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            aria-label={`${labels[i]}: ${format(v)}`}
          >
            <i style={{ height: `${(v / max) * 100}%` }} />
            <small>{labels[i]}</small>
          </button>
        ))}
      </div>
      {hover !== null && (
        <div className="chart-tip" role="status">
          <small>{labels[hover]}</small>
          <strong>{format(values[hover])}</strong>
          <small>{detail(hover)}</small>
        </div>
      )}
    </div>
  );
}

function LineChart({
  values,
  labels,
}: {
  values: (number | null)[];
  labels: string[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = values.length;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const y = (v: number) => 100 - v * 100;
  const pts = values
    .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
    .filter(Boolean)
    .join(" ");
  return (
    <div className="finance-line" onMouseLeave={() => setHover(null)}>
      <div className="finance-line-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} className="grid" x1="0" x2="100" y1={y(g)} y2={y(g)} vectorEffect="non-scaling-stroke" />
          ))}
          {hover !== null && (
            <line className="crosshair" x1={x(hover)} x2={x(hover)} y1="0" y2="100" vectorEffect="non-scaling-stroke" />
          )}
          <polyline points={pts} vectorEffect="non-scaling-stroke" />
        </svg>
        {values.map((v, i) =>
          v === null ? null : (
            <i
              key={i}
              className={"line-dot" + (hover === i ? " active" : "")}
              style={{ left: `${x(i)}%`, top: `${y(v)}%` }}
            />
          ),
        )}
        <div className="line-hits">
          {values.map((v, i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              aria-label={`${labels[i]}: ${pct(v)}`}
            />
          ))}
        </div>
        <span className="line-axis top">100%</span>
        <span className="line-axis bottom">0%</span>
      </div>
      <div className="finance-line-labels" aria-hidden="true">
        {labels.map((l, i) => (
          <small key={i}>{l}</small>
        ))}
      </div>
      {hover !== null && (
        <div className="chart-tip" role="status">
          <small>{labels[hover]}</small>
          <strong>{pct(values[hover])}</strong>
        </div>
      )}
    </div>
  );
}

"use client";
import type { performance } from "@/cala/domain/analytics/performance";
import { money } from "@/cala/lib/format";
const colors = [
  "var(--accent)",
  "var(--cala-clay)",
  "var(--text)",
  "var(--muted)",
  "var(--accent-border)",
];
export function Distribution({
  title,
  entries,
  format = (n) => String(n),
}: {
  title: string;
  entries: { label: string; value: number }[];
  format?: (n: number) => string;
}) {
  const rows = entries.filter((e) => e.value > 0),
    total = rows.reduce((sum, row) => sum + row.value, 0);
  let position = 0;
  const gradient = rows
    .map((row, i) => {
      const start = position;
      position += (row.value / total) * 100;
      return `${colors[i % colors.length]} ${start}% ${position}%`;
    })
    .join(",");
  return (
    <section className="panel channel-distribution">
      <h3>{title}</h3>
      <div
        className="channel-donut"
        style={{
          background: total ? `conic-gradient(${gradient})` : "var(--subtle)",
        }}
        aria-hidden="true"
      >
        <span>{total ? "100%" : "—"}</span>
      </div>
      {total ? (
        <ul>
          {rows.map((row, i) => (
            <li key={row.label}>
              <i
                style={{ background: colors[i % colors.length] }}
                aria-hidden="true"
              />
              <span>{row.label}</span>
              <strong>{((row.value / total) * 100).toFixed(1)}%</strong>
              <small>{format(row.value)}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Sin datos para esta distribución.</p>
      )}
      {total > 0 && (
        <p className="distribution-total">
          Total: <strong>{format(total)}</strong>
        </p>
      )}
    </section>
  );
}
export function ChannelCharts({
  report,
  currency,
  finance,
}: {
  report: ReturnType<typeof performance>;
  currency: string;
  finance: boolean;
}) {
  return (
    <div
      className="channel-distributions"
      aria-label="Distribuciones por canal"
    >
      {finance && (
        <Distribution
          title="Alojamiento por canal"
          entries={report.channels.map((c) => ({
            label: c.source,
            value: c.revenueMinor,
          }))}
          format={(n) => money(n, currency)}
        />
      )}
      <Distribution
        title="Reservas por canal"
        entries={report.channels.map((c) => ({
          label: c.source,
          value: c.bookings,
        }))}
      />
      <Distribution
        title="Noches por canal"
        entries={report.channels.map((c) => ({
          label: c.source,
          value: c.nights,
        }))}
      />
      <Distribution
        title="Cancelaciones por canal"
        entries={report.cancellationsByChannel.map((c) => ({
          label: c.source,
          value: c.count,
        }))}
      />
    </div>
  );
}

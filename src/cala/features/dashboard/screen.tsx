"use client";
import { SetupScore } from "@/cala/components/ui/setup-score";
import { netPaid } from "@/cala/domain/reservations/payments";
import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { conceptLabels } from "@/cala/features/onboarding/screen";
import { addDays, nights } from "@/cala/domain/shared/dates";
import Link from "next/link";
import { useWorkspace } from "@/cala/features/workspace/context";
import {
  SectionTitle,
  Icon,
  Badge,
  Empty,
  fitChars,
} from "@/cala/components/ui/primitives";
import {
  ReservationTable,
  ReservationInspector,
  ReservationForm,
} from "@/cala/features/reservations/components";
import { money, shortDate } from "@/cala/lib/format";
import { useI18n } from "@/cala/lib/i18n";
import { CustomizeWorkspace } from "@/cala/features/workspace/customize";
import { RecentActivity } from "@/cala/features/workspace/activity";
import { workspacePreferences } from "@/cala/domain/workspace/preferences";
export function Dashboard() {
  const { data, can } = useWorkspace();
  const { t } = useI18n();
  const [customize, setCustomize] = useState(false);
  const panels = workspacePreferences(
    data.workspacePreferences?.find(
      (x) =>
        x.userId === data.currentUser.id &&
        x.organizationId === data.currentOrganizationId,
    )?.preferences,
  ).dashboard;
  const [tab, setTab] = useState("arrivals");
  const [selected, setSelected] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  const p = data.properties.find((p) => p.id === data.currentPropertyId);
  const reservations = data.reservations.filter((r) => r.propertyId === p?.id);
  const units = data.units.filter((u) => u.propertyId === p?.id);
  const occupied = reservations.filter(
    (r) =>
      r.arrival <= data.today &&
      r.departure > data.today &&
      ["confirmed", "checked_in", "pending"].includes(r.status),
  );
  const arrivals = reservations.filter(
    (r) =>
      r.arrival === data.today &&
      ["confirmed", "pending", "checked_in"].includes(r.status),
  );
  const departures = reservations.filter(
    (r) =>
      r.departure === data.today &&
      ["checked_in", "checked_out", "confirmed"].includes(r.status),
  );
  const dirty = units.filter((u) => u.housekeeping === "dirty");
  const tasks = data.tasks.filter(
    (t) => t.propertyId === p?.id && t.status !== "completed",
  );
  const filtered =
    tab === "arrivals"
      ? arrivals
      : tab === "departures"
        ? departures
        : occupied;
  const total = data.folioItems
    .filter((i) => i.propertyId === p?.id)
    .reduce((a, b) => a + b.amountMinor, 0);
  const paid = netPaid(data.payments.filter((i) => i.propertyId === p?.id));
  return (
    <>
      <SectionTitle
        eyebrow={
          shortDate(data.today).toUpperCase() +
          " · " +
          (p?.city ?? t("TU ESPACIO"))
        }
        title={t("Hola, {name}.", {
          name: data.currentUser.name.split(" ")[0],
        })}
        description={
          p
            ? t("Así se siente hoy {name}.", { name: p.name })
            : t("Demos la bienvenida a tu primera propiedad.")
        }
      >
        {p && (
          <button
            className="button secondary"
            onClick={() => setCustomize(true)}
          >
            <Icon name="settings" />
            Personalizar Inicio
          </button>
        )}
        {can("reservation.write") && p && (
          <button className="button primary" onClick={() => setCreate(true)}>
            <Icon name="plus" />
            {t("Nueva reserva")}
          </button>
        )}
      </SectionTitle>
      {!p ? (
        <Empty
          title={t("Tu próxima historia empieza aquí")}
          description={t("Configura una propiedad para comenzar.")}
        >
          <Link href="/admin/onboarding" className="button primary">
            {t("Crear mi primera propiedad")}
          </Link>
        </Empty>
      ) : (
        <>
          {panels.setup && <SetupScore />}
          {panels.metrics && (
            <div className="stats">
              <Stat
                label={t("Llegadas de hoy")}
                value={arrivals.length}
                icon="arrival"
                note={t("Nuevas historias por recibir")}
              />
              <Stat
                label={t("Salidas de hoy")}
                value={departures.length}
                icon="departure"
                note={t("Hasta la próxima estancia")}
              />
              <Stat
                label={t("En casa")}
                value={occupied.length}
                icon="bed"
                note={t("{count} unidades en tu propiedad", {
                  count: units.length,
                })}
              />
              <Stat
                label={
                  can("finance.read")
                    ? t("Saldo por cobrar")
                    : t("Unidades por limpiar")
                }
                value={
                  can("finance.read")
                    ? money(total - paid, p.currency)
                    : dirty.length
                }
                icon={can("finance.read") ? "payment" : "housekeeping"}
                note={
                  can("finance.read")
                    ? t("Saldo de todos los folios")
                    : t("Preparar antes de la llegada")
                }
              />
            </div>
          )}
          <div className="dashboard-grid" data-daily={panels.daily}>
            {panels.daily && (
              <section className="panel daily-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{t("EL RITMO DEL DÍA")}</p>
                    <h2>{t("Hoy en tu propiedad")}</h2>
                  </div>
                  <Link href="/admin/calendario" className="text-link">
                    {t("Ver calendario")}{" "}
                    <Icon name="chevron-right" size={16} />
                  </Link>
                </div>
                <div
                  className="tabs"
                  role="tablist"
                  aria-label={t("Operación de hoy")}
                >
                  {[
                    ["arrivals", "Llegadas", arrivals.length],
                    ["departures", "Salidas", departures.length],
                    ["inhouse", "En casa", occupied.length],
                  ].map(([id, label, count]) => (
                    <button
                      role="tab"
                      aria-selected={tab === id}
                      key={id}
                      onClick={() => setTab(String(id))}
                      className={tab === id ? "active" : ""}
                    >
                      {t(String(label))}
                      <span>{count}</span>
                    </button>
                  ))}
                </div>
                {can("reservation.read") ? (
                  <ReservationTable
                    reservations={filtered}
                    onSelect={setSelected}
                  />
                ) : (
                  <Empty
                    title={t("La operación está en tus manos")}
                    description={t(
                      "Consulta tus tareas de limpieza y mantenimiento.",
                    )}
                  >
                    <Link className="button secondary" href="/admin/limpieza">
                      {t("Ver housekeeping")}
                    </Link>
                  </Empty>
                )}
                <div className="panel-foot">
                  <span className="status-dot" />{" "}
                  {t("Disponibilidad actualizada con cada operación")}
                </div>
              </section>
            )}
            <aside className="attention-column">
              <div className="panel attention">
                <div className="panel-heading">
                  <h2>{t("Necesita tu atención")}</h2>
                  <span className="count-circle">
                    {dirty.length + tasks.length}
                  </span>
                </div>
                {dirty.length > 0 && (
                  <Link href="/admin/limpieza" className="attention-item">
                    <span className="attention-icon amber">
                      <Icon name="housekeeping" />
                    </span>
                    <div>
                      <strong>
                        {dirty.length}{" "}
                        {dirty.length === 1
                          ? t("unidad por preparar")
                          : t("unidades por preparar")}
                      </strong>
                      <p>{t("Todo listo para una buena llegada.")}</p>
                    </div>
                    <Icon name="chevron-right" size={16} />
                  </Link>
                )}
                {tasks.map((task) => (
                  <Link
                    href={
                      task.kind === "housekeeping"
                        ? "/admin/limpieza"
                        : "/admin/mantenimiento"
                    }
                    key={task.id}
                    className="attention-item"
                  >
                    <span className="attention-icon">
                      <Icon
                        name={
                          task.kind === "housekeeping"
                            ? "clean-room"
                            : "maintenance"
                        }
                      />
                    </span>
                    <div>
                      <strong>{task.title}</strong>
                      <p>
                        {data.units.find((u) => u.id === task.unitId)?.name ??
                          t("Propiedad")}{" "}
                        ·{" "}
                        {task.priority === "high"
                          ? t("Prioridad alta")
                          : t("En seguimiento")}
                      </p>
                    </div>
                  </Link>
                ))}
                {!dirty.length && !tasks.length && (
                  <p className="muted padded">
                    {t("No hay pendientes urgentes.")}
                  </p>
                )}
              </div>
              <div className="property-note">
                <span className="eyebrow">
                  {t("ESPACIO PARA LO IMPORTANTE")}
                </span>
                <h3>
                  {t("Una buena estancia")}
                  <br />
                  {t("empieza antes de llegar.")}
                </h3>
                <p>
                  {t(
                    "Consulta los detalles, prepara las habitaciones y recibe con calma.",
                  )}
                </p>
                <Link href="/admin/inventario">
                  {t("Revisar mi propiedad")}{" "}
                  <Icon name="chevron-right" size={16} />
                </Link>
              </div>
            </aside>
          </div>
          {panels.activity && <RecentActivity />}
          <div className="panel portfolio">
            <div className="portfolio-header">
              <div>
                <p className="eyebrow">{t("TU PORTAFOLIO")}</p>
                <h2>{t("Hospitalidad en cada lugar")}</h2>
              </div>
              {can("property.write") && (
                <Link href="/admin/onboarding" className="button primary">
                  <Icon name="plus" />
                  {t("Nueva propiedad")}
                </Link>
              )}
            </div>
            <Portfolio />
          </div>
        </>
      )}
      {selected && (
        <ReservationInspector id={selected} onClose={() => setSelected(null)} />
      )}{" "}
      {create && <ReservationForm onClose={() => setCreate(false)} />}
      {customize && (
        <CustomizeWorkspace
          section="dashboard"
          onClose={() => setCustomize(false)}
        />
      )}
    </>
  );
}
function Stat({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: string | number;
  icon: Parameters<typeof Icon>[0]["name"];
  note: string;
}) {
  return (
    <div className="stat">
      <div className="row between">
        <span>{label}</span>
        <Icon name={icon} />
      </div>
      <strong style={fitChars(value)}>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
const ACTIVE = ["confirmed", "checked_in", "pending"];
function conceptIcon(concept: string) {
  return concept === "hostel"
    ? "hostel"
    : concept === "entire_home"
      ? "entire-home"
      : concept === "villas"
        ? "villa"
        : "hotel";
}
/** Portfolio grid: a card per property; tapping one reveals its details. */
function Portfolio() {
  const { data } = useWorkspace();
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const openProperty = data.properties.find((p) => p.id === open);
  return (
    <>
      <div className="portfolio-grid">
        {data.properties.map((prop) => (
          <PropertyCard
            key={prop.id}
            id={prop.id}
            open={open === prop.id}
            onToggle={() => setOpen((v) => (v === prop.id ? null : prop.id))}
          />
        ))}
      </div>
      <div
        className={"portfolio-details-wrap" + (openProperty ? " open" : "")}
        aria-hidden={!openProperty}
      >
        <div className="portfolio-details-clip">
          {openProperty && (
            <PropertyDetails
              key={openProperty.id}
              id={openProperty.id}
              onClose={() => setOpen(null)}
            />
          )}
        </div>
      </div>
    </>
  );
}
function PropertyCard({
  id,
  open,
  onToggle,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { data } = useWorkspace();
  const { t } = useI18n();
  const p = data.properties.find((p) => p.id === id)!;
  return (
    <button
      type="button"
      className={
        "property-card " +
        (id === data.currentPropertyId ? "selected " : "") +
        (open ? "open" : "")
      }
      aria-expanded={open}
      aria-controls={"property-details-" + id}
      onClick={onToggle}
    >
      <div className="row between">
        <Icon name={conceptIcon(p.concept)} size={28} />
        {id === data.currentPropertyId && (
          <Badge status="connected">{t("Actual")}</Badge>
        )}
      </div>
      <strong>{p.name}</strong>
      <span>{p.city}</span>
      <small>
        {t("{count} unidades", {
          count: data.units.filter((u) => u.propertyId === id).length,
        })}{" "}
        <span className="property-card-chevron">
          <Icon name="chevron-right" size={14} />
        </span>
      </small>
    </button>
  );
}
function PropertyDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, select, can } = useWorkspace();
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const p = data.properties.find((x) => x.id === id)!;
  const isCurrent = id === data.currentPropertyId;
  const day = data.today;
  const in30 = addDays(day, 30);
  const units = data.units.filter((u) => u.propertyId === id);
  const res = data.reservations.filter(
    (r) => r.propertyId === id && ACTIVE.includes(r.status),
  );
  const inHouse = res.filter((r) => r.arrival <= day && r.departure > day);
  const arrivals = res.filter((r) => r.arrival === day);
  const departures = data.reservations.filter(
    (r) =>
      r.propertyId === id &&
      r.departure === day &&
      ["checked_in", "checked_out", "confirmed"].includes(r.status),
  );
  const upcoming = res
    .filter((r) => r.arrival > day && r.arrival <= in30)
    .sort((a, b) => a.arrival.localeCompare(b.arrival));
  // Occupied unit-nights over the next 30 days / available unit-nights.
  let bookedNights = 0;
  for (const r of res) {
    const from = r.arrival > day ? r.arrival : day;
    const to = r.departure < in30 ? r.departure : in30;
    if (to > from) bookedNights += nights(from, to).length;
  }
  const capacity = Math.max(units.length * 30, 1);
  const occupancy30 = Math.min(100, Math.round((bookedNights / capacity) * 100));
  const occupancyToday = units.length
    ? Math.min(100, Math.round((inHouse.length / units.length) * 100))
    : 0;
  const openTasks = data.tasks.filter(
    (x) => x.propertyId === id && x.status !== "completed",
  ).length;
  const dirty = units.filter((u) => u.housekeeping === "dirty").length;
  const types = data.inventoryTypes.filter(
    (x) => x.propertyId === id && x.active,
  );
  const fromRate = types.length
    ? Math.min(...types.map((x) => x.baseRateMinor))
    : 0;
  const balance =
    data.folioItems
      .filter((i) => i.propertyId === id)
      .reduce((a, b) => a + b.amountMinor, 0) -
    netPaid(data.payments.filter((i) => i.propertyId === id));
  const go = async (path: string) => {
    if (busy) return;
    setBusy(true);
    try {
      if (!isCurrent) await select(p.organizationId, id);
      router.push("/admin/" + path);
    } finally {
      setBusy(false);
    }
  };
  const kpis: {
    label: string;
    value: string | number;
    icon: Parameters<typeof Icon>[0]["name"];
    meter?: number;
  }[] = [
    {
      label: t("Ocupación hoy"),
      value: occupancyToday + "%",
      icon: "occupancy",
      meter: occupancyToday,
    },
    {
      label: t("Próximos 30 días"),
      value: occupancy30 + "%",
      icon: "occupancy-chart",
      meter: occupancy30,
    },
    { label: t("Llegadas de hoy"), value: arrivals.length, icon: "arrival" },
    {
      label: t("Salidas de hoy"),
      value: departures.length,
      icon: "departure",
    },
    { label: t("En casa"), value: inHouse.length, icon: "guests" },
    {
      label: t("Tareas abiertas"),
      value: openTasks + dirty,
      icon: "housekeeping",
    },
  ];
  return (
    <section
      className="property-details"
      id={"property-details-" + id}
      aria-label={p.name}
    >
      <header className="property-details-head">
        <span className="property-details-mark" aria-hidden="true">
          <Icon name={conceptIcon(p.concept)} size={26} />
        </span>
        <div className="property-details-title">
          <p className="eyebrow">
            {t(conceptLabels[p.concept] ?? "Otro alojamiento")} · {p.city}
            {p.country ? ", " + p.country : ""}
          </p>
          <h3>{p.name}</h3>
          {p.address && <p className="muted">{p.address}</p>}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Cerrar detalles")}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="property-details-kpis">
        {kpis.map((k, i) => (
          <div
            className="property-kpi"
            key={k.label}
            style={{ "--i": i } as CSSProperties}
          >
            <span className="property-kpi-label">
              <Icon name={k.icon} size={15} />
              {k.label}
            </span>
            <strong>{k.value}</strong>
            {k.meter !== undefined && (
              <span className="property-kpi-meter" aria-hidden="true">
                <span style={{ width: k.meter + "%" }} />
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="property-details-body">
        <dl className="property-facts">
          <div>
            <dt>{t("Unidades")}</dt>
            <dd>{units.length}</dd>
          </div>
          <div>
            <dt>{t("Tipos de alojamiento")}</dt>
            <dd>{types.length}</dd>
          </div>
          <div>
            <dt>{t("Check-in / check-out")}</dt>
            <dd>
              {p.checkIn || "—"} · {p.checkOut || "—"}
            </dd>
          </div>
          <div>
            <dt>{t("Moneda")}</dt>
            <dd>{p.currency}</dd>
          </div>
          {can("finance.read") && fromRate > 0 && (
            <div>
              <dt>{t("Tarifa desde")}</dt>
              <dd>{money(fromRate, p.currency)}</dd>
            </div>
          )}
          {can("finance.read") && (
            <div>
              <dt>{t("Saldo por cobrar")}</dt>
              <dd>{money(Math.max(0, balance), p.currency)}</dd>
            </div>
          )}
        </dl>
        <div className="property-upcoming">
          <p className="eyebrow">{t("PRÓXIMAS LLEGADAS")}</p>
          {upcoming.length ? (
            <ul>
              {upcoming.slice(0, 4).map((r) => {
                const g = data.guests.find((x) => x.id === r.guestId);
                return (
                  <li key={r.id}>
                    <span className="property-upcoming-date">
                      {shortDate(r.arrival)}
                    </span>
                    <span className="property-upcoming-name">
                      {g
                        ? `${g.firstName} ${g.lastName}`.trim()
                        : r.confirmationCode}
                    </span>
                    <small>
                      {t(
                        nights(r.arrival, r.departure).length === 1
                          ? "{n} noche"
                          : "{n} noches",
                        { n: nights(r.arrival, r.departure).length },
                      )}
                    </small>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">
              {t("Sin llegadas en los próximos 30 días.")}
            </p>
          )}
        </div>
      </div>
      <footer className="property-details-actions">
        {!isCurrent && (
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await select(p.organizationId, id);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Icon name="check" />
            {t("Trabajar en esta propiedad")}
          </button>
        )}
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => void go("calendario")}
        >
          <Icon name="calendar" />
          {t("Calendario")}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => void go("tarifas")}
        >
          <Icon name="rates" />
          {t("Tarifas")}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => void go("inventario")}
        >
          <Icon name="inventory" />
          {t("Inventario")}
        </button>
      </footer>
    </section>
  );
}

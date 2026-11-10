"use client";
import { useState } from "react";
import { uiLocale } from "@/cala/lib/format";
import Link from "next/link";
import { useWorkspace } from "@/cala/features/workspace/context";
import { Empty, Icon } from "@/cala/components/ui/primitives";
import {
  guestName,
  ReservationForm,
  ReservationInspector,
} from "@/cala/features/reservations/components";
import { money } from "@/cala/lib/format";
import { CustomizeWorkspace } from "@/cala/features/workspace/customize";
import { RecentActivity } from "@/cala/features/workspace/activity";
import { SetupScore } from "@/cala/components/ui/setup-score";
import { workspacePreferences } from "@/cala/domain/workspace/preferences";
export function MobileHome() {
  const { data, can } = useWorkspace();
  const [customize, setCustomize] = useState(false);
  const panels = workspacePreferences(
    data.workspacePreferences?.find(
      (x) =>
        x.userId === data.currentUser.id &&
        x.organizationId === data.currentOrganizationId,
    )?.preferences,
  ).dashboard;
  const [tab, setTab] = useState<"arrival" | "departure" | "inhouse">(
    "arrival",
  );
  const [selected, setSelected] = useState<string | null>(null),
    [create, setCreate] = useState(false);
  const property = data.properties.find((p) => p.id === data.currentPropertyId);
  const all = data.reservations.filter(
    (r) =>
      r.propertyId === data.currentPropertyId &&
      !["cancelled", "no_show", "draft"].includes(r.status),
  );
  const arrivals = all.filter(
    (r) =>
      r.arrival === data.today && ["pending", "confirmed"].includes(r.status),
  );
  const departures = all.filter(
    (r) => r.departure === data.today && r.status === "checked_in",
  );
  const inhouse = all.filter((r) => r.status === "checked_in");
  const tasks = data.tasks.filter(
    (t) => t.propertyId === data.currentPropertyId && t.status !== "completed",
  );
  const dirty = data.units.filter(
    (u) =>
      u.propertyId === data.currentPropertyId &&
      u.active &&
      u.housekeeping === "dirty",
  );
  const blocked = data.channels.filter(
    (c) => c.propertyId === data.currentPropertyId && c.status === "error",
  );
  const list =
    tab === "arrival" ? arrivals : tab === "departure" ? departures : inhouse;
  return (
    <section className="m-home">
      <div className="m-screen-heading">
        <div>
          <p className="eyebrow">TU OPERACIÓN, A LA MANO</p>
          <h1>Hola, {data.currentUser.name.split(" ")[0]}.</h1>
          <p>
            {new Intl.DateTimeFormat(uiLocale(), {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "UTC",
            }).format(new Date(data.today + "T12:00:00Z"))}
          </p>
        </div>
        {property && (
          <button
            className="m-round-button"
            aria-label="Personalizar Inicio"
            onClick={() => setCustomize(true)}
          >
            <Icon name="settings" />
          </button>
        )}
      </div>
      {!property ? (
        <div className="m-welcome-card">
          <Icon name="property" size={33} />
          <h2>Tu próxima historia empieza aquí</h2>
          <p>
            Configura tu propiedad para empezar a recibir huéspedes y organizar
            cada estancia.
          </p>
          {can("property.write") && (
            <Link className="button primary" href="/admin/onboarding">
              Configurar propiedad
            </Link>
          )}
        </div>
      ) : (
        <>
          {can("reservation.read") && (
            <>
              {panels.metrics && (
                <div className="m-today-summary" aria-label="Resumen de hoy">
                  <button onClick={() => setTab("arrival")}>
                    <strong>{arrivals.length}</strong>
                    <span>Llegadas</span>
                  </button>
                  <button onClick={() => setTab("departure")}>
                    <strong>{departures.length}</strong>
                    <span>Salidas</span>
                  </button>
                  <button onClick={() => setTab("inhouse")}>
                    <strong>{inhouse.length}</strong>
                    <span>En casa</span>
                  </button>
                </div>
              )}
              {can("reservation.write") && (
                <button
                  className="button primary m-primary-action"
                  onClick={() => setCreate(true)}
                >
                  <Icon name="plus" />
                  Nueva reserva
                </button>
              )}
              {panels.daily && (
                <>
                  <div className="m-section-title">
                    <h2>El día de hoy</h2>
                    <Link href="/admin/calendario">
                      Ver calendario <Icon name="chevron-right" size={15} />
                    </Link>
                  </div>
                  <div className="m-segmented" aria-label="Estancias de hoy">
                    {(
                      [
                        ["arrival", "Llegadas"],
                        ["departure", "Salidas"],
                        ["inhouse", "En casa"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        aria-pressed={tab === key}
                        className={tab === key ? "active" : ""}
                        onClick={() => setTab(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="m-stay-list">
                    {list.map((r) => (
                      <article className="m-stay-card" key={r.id}>
                        <button
                          className="m-stay-open"
                          onClick={() => setSelected(r.id)}
                        >
                          <span className={`m-state-mark ${r.status}`} />
                          <span>
                            <strong>{guestName(data.guests, r.guestId)}</strong>
                            <small>
                              {data.units.find((u) => u.id === r.unitId)
                                ?.name ?? "Pendiente de asignar"}{" "}
                              · {r.source}
                            </small>
                            <small>{r.confirmationCode}</small>
                          </span>
                          <Icon name="chevron-right" size={18} />
                        </button>
                      </article>
                    ))}
                  </div>
                  {!list.length && (
                    <Empty
                      title={
                        tab === "arrival"
                          ? "Sin llegadas pendientes"
                          : tab === "departure"
                            ? "Sin salidas pendientes"
                            : "Todavía no hay huéspedes en casa"
                      }
                      description="Consulta el calendario para organizar los próximos días."
                    />
                  )}
                </>
              )}
            </>
          )}
          <div className="m-section-title">
            <h2>Necesita atención</h2>
          </div>
          <div className="m-attention-list">
            <Link href="/admin/limpieza">
              <Icon name="housekeeping" />
              <span>
                <strong>{dirty.length} unidades por limpiar</strong>
                <small>Revisa que estén listas para la próxima llegada</small>
              </span>
              <Icon name="chevron-right" size={16} />
            </Link>
            <Link href="/admin/mantenimiento">
              <Icon name="maintenance" />
              <span>
                <strong>{tasks.length} tareas pendientes</strong>
                <small>Limpieza y mantenimiento de esta propiedad</small>
              </span>
              <Icon name="chevron-right" size={16} />
            </Link>
            {can("channel.manage") && blocked.length > 0 && (
              <Link href="/admin/canales">
                <Icon name="channels" />
                <span>
                  <strong>{blocked.length} conexiones con incidencias</strong>
                  <small>
                    Consulta su estado antes de vender disponibilidad
                  </small>
                </span>
                <Icon name="chevron-right" size={16} />
              </Link>
            )}
          </div>
          {panels.metrics && can("finance.read") && (
            <div className="m-finance-summary">
              <span>Cargos de estancias en casa</span>
              <strong>
                {money(
                  data.folioItems
                    .filter((i) =>
                      inhouse.some((r) => r.id === i.reservationId),
                    )
                    .reduce((sum, i) => sum + i.amountMinor, 0),
                  property.currency,
                )}
              </strong>
              <Link href="/admin/finanzas">
                Abrir finanzas <Icon name="chevron-right" size={16} />
              </Link>
            </div>
          )}
          {panels.activity && <RecentActivity />}
          {panels.setup && <SetupScore />}
        </>
      )}
      {selected && (
        <ReservationInspector id={selected} onClose={() => setSelected(null)} />
      )}
      {create && <ReservationForm onClose={() => setCreate(false)} />}
      {customize && (
        <CustomizeWorkspace
          section="dashboard"
          onClose={() => setCustomize(false)}
        />
      )}
    </section>
  );
}

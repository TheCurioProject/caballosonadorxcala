"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/cala/features/workspace/context";
import { Empty, Icon, Modal } from "@/cala/components/ui/primitives";
import {
  guestName,
  ReservationForm,
  ReservationInspector,
} from "@/cala/features/reservations/components";
import { shortDate, statusLabels } from "@/cala/lib/format";
export function MobileReservations() {
  const { data, can } = useWorkspace();
  const params = useSearchParams();
  const [create, setCreate] = useState(params.get("new") === "1");
  const [selected, setSelected] = useState<string | null>(
    params.get("reservation"),
  );
  const [query, setQuery] = useState("");
  const [view, setView] = useState("upcoming"),
    [source, setSource] = useState(""),
    [filtering, setFiltering] = useState(false);
  const all = data.reservations.filter(
    (r) => r.propertyId === data.currentPropertyId,
  );
  const reservations = all
    .filter((r) => {
      if (source && r.source !== source) return false;
      if (
        view === "upcoming" &&
        (!["pending", "confirmed"].includes(r.status) ||
          r.departure < data.today)
      )
        return false;
      if (view === "checked_in" && r.status !== "checked_in") return false;
      if (
        view === "today" &&
        (r.arrival !== data.today ||
          !["confirmed", "pending"].includes(r.status))
      )
        return false;
      return `${guestName(data.guests, r.guestId)} ${r.confirmationCode} ${data.units.find((u) => u.id === r.unitId)?.name ?? ""}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase());
    })
    .sort((a, b) =>
      view === "all"
        ? b.arrival.localeCompare(a.arrival)
        : a.arrival.localeCompare(b.arrival),
    );
  return (
    <section>
      <div className="m-screen-heading">
        <div>
          <p className="eyebrow">CADA ESTANCIA CUENTA</p>
          <h1>Reservas</h1>
          <p>Encuentra y gestiona cada estancia.</p>
        </div>
        {can("reservation.write") && (
          <button
            className="m-round-button primary"
            aria-label="Nueva reserva"
            onClick={() => setCreate(true)}
          >
            <Icon name="plus" />
          </button>
        )}
      </div>
      <label className="m-search">
        <Icon name="search" />
        <input
          aria-label="Buscar reservas"
          placeholder="Huésped, habitación o confirmación"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="m-round-button"
          aria-label="Filtrar reservas por canal"
          onClick={() => setFiltering(true)}
        >
          <Icon name="filter" size={18} />
        </button>
      </label>
      <div className="m-filter-pills" aria-label="Filtrar estancias">
        {(
          [
            ["upcoming", "Próximas"],
            ["today", "Llegan hoy"],
            ["checked_in", "En casa"],
            ["all", "Todas"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={view === key ? "active" : ""}
            aria-pressed={view === key}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="m-result-count">
        {reservations.length} estancias {source && `· ${source}`}
      </p>
      <div className="m-stay-list">
        {reservations.map((r) => (
          <article key={r.id} className="m-stay-card">
            <button className="m-stay-open" onClick={() => setSelected(r.id)}>
              <span className={`m-state-mark ${r.status}`} />
              <span>
                <strong>{guestName(data.guests, r.guestId)}</strong>
                <small>
                  {data.units.find((u) => u.id === r.unitId)?.name ??
                    "Sin asignar"}{" "}
                  · {r.adults + r.children} huéspedes
                </small>
                <small>
                  {shortDate(r.arrival)} — {shortDate(r.departure)}
                </small>
              </span>
              <Icon name="chevron-right" size={17} />
            </button>
            <div className="m-stay-footer">
              <span>{statusLabels[r.status] ?? r.status}</span>
              <span>
                {r.source} · {r.confirmationCode}
              </span>
            </div>
          </article>
        ))}
      </div>
      {!reservations.length && (
        <Empty
          title="Sin estancias en esta vista"
          description="Prueba otro filtro o busca por el nombre del huésped."
        />
      )}
      {selected && (
        <ReservationInspector id={selected} onClose={() => setSelected(null)} />
      )}
      {create && <ReservationForm onClose={() => setCreate(false)} />}
      {filtering && (
        <Modal title="Canal de reserva" onClose={() => setFiltering(false)}>
          <label className="field">
            <span>Canal</span>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Todos los canales</option>
              {[...new Set(all.map((r) => r.source))].sort().map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button primary"
            onClick={() => setFiltering(false)}
          >
            Ver reservas
          </button>
        </Modal>
      )}
    </section>
  );
}

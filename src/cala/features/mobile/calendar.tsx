"use client";
import { useId, useState } from "react";
import { uiLocale } from "@/cala/lib/format";
import {
  PropertyWorkspace,
  useWorkspace,
} from "@/cala/features/workspace/context";
import { CustomizeWorkspace } from "@/cala/features/workspace/customize";
import { workspacePreferences } from "@/cala/domain/workspace/preferences";
import { CalendarOverview } from "@/cala/features/reservations/calendar-overview";
import {
  CalendarQuickView,
  CalendarRangeDialog,
  CalendarBlockInfo,
  type CalendarRange,
} from "@/cala/features/reservations/calendar-actions";
import { Empty, Icon, Modal } from "@/cala/components/ui/primitives";
import {
  guestName,
  ReservationForm,
  ReservationInspector,
} from "@/cala/features/reservations/components";
import {
  CalendarLayoutSwitch,
  MoveDialog,
  type Move,
} from "@/cala/features/reservations/calendar";
import { MultiCalendar } from "@/cala/features/reservations/multi-calendar";
import { SingleCalendar } from "@/cala/features/reservations/single-calendar";
import {
  monthLabel,
  useCalendarLayout,
} from "@/cala/features/reservations/calendar-shared";
import { addDays, overlaps } from "@/cala/domain/shared/dates";
import type { Reservation } from "@/cala/domain/model";
import { shortDate, statusLabels } from "@/cala/lib/format";
import { monthGrid, shiftMonth } from "./calendar-dates";

const movable = (r: Reservation) =>
  ["pending", "confirmed", "checked_in"].includes(r.status);
export function MobileCalendar() {
  const fieldId = useId();
  const { data, can } = useWorkspace();
  const preferences = workspacePreferences(
    data.workspacePreferences?.find(
      (p) =>
        p.userId === data.currentUser.id &&
        p.organizationId === data.currentOrganizationId,
    )?.preferences,
  );
  const [view, setView] = useState<"rooms" | "agenda" | "month" | "year">(
    preferences.calendar.view === "timeline"
      ? "rooms"
      : preferences.calendar.view,
  );
  const [scope, setScope] = useState(preferences.calendar.scope);
  const [customize, setCustomize] = useState(false),
    [preview, setPreview] = useState<Reservation | null>(null);
  const [range, setRange] = useState<CalendarRange | null>(null),
    [blockId, setBlockId] = useState<string | null>(null);
  const [layout, setLayout] = useCalendarLayout();
  const [date, setDate] = useState(data.today),
    [anchor, setAnchor] = useState(data.today);
  const [flash, setFlash] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null),
    [move, setMove] = useState<Move | null>(null);
  const [choosing, setChoosing] = useState(false),
    [filtering, setFiltering] = useState(false);
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState(""),
    [source, setSource] = useState(""),
    [search, setSearch] = useState("");
  const units = data.units.filter(
    (u) =>
      (scope === "organization" || u.propertyId === data.currentPropertyId) &&
      u.active &&
      (!type || u.inventoryTypeId === type),
  );
  const all = data.reservations.filter(
    (r) =>
      (scope === "organization" || r.propertyId === data.currentPropertyId) &&
      !["cancelled", "no_show", "draft"].includes(r.status),
  );
  const reservations = all.filter(
    (r) =>
      (!type || r.inventoryTypeId === type) &&
      (!source || r.source === source) &&
      `${guestName(data.guests, r.guestId)} ${r.confirmationCode} ${data.units.find((u) => u.id === r.unitId)?.name ?? ""}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const dateLabel =
    view === "year" && layout === "multiple"
      ? anchor.slice(0, 4)
      : monthLabel(anchor);
  const agenda = reservations.filter((r) =>
    overlaps(date, addDays(date, 1), r.arrival, r.departure),
  );
  function navigate(delta: number) {
    if (view === "agenda" && layout === "multiple") {
      const next = addDays(anchor, delta * 7);
      setAnchor(next);
      setDate(next);
      return;
    }
    const next = shiftMonth(
      anchor,
      delta * (view === "year" && layout === "multiple" ? 12 : 1),
    );
    setAnchor(next);
    setDate(next);
  }
  function choose(r: Reservation) {
    setChoosing(false);
    setMove({
      reservation: { ...r },
      unitId: r.unitId ?? "",
      arrival: r.arrival,
    });
  }
  function card(r: Reservation) {
    return (
      <article key={r.id} className="m-stay-card">
        <button className="m-stay-open" onClick={() => setSelected(r.id)}>
          <span className={`m-state-mark ${r.status}`} />
          <span>
            <strong>{guestName(data.guests, r.guestId)}</strong>
            <small>
              {data.units.find((u) => u.id === r.unitId)?.name ?? "Sin asignar"}{" "}
              · {r.source}
            </small>
            <small>
              {shortDate(r.arrival)} — {shortDate(r.departure)} ·{" "}
              {r.confirmationCode}
            </small>
          </span>
          <Icon name="chevron-right" size={17} />
        </button>
        <div className="m-stay-footer">
          <span>{statusLabels[r.status] ?? r.status}</span>
          {can("reservation.write") && movable(r) && (
            <button onClick={() => choose(r)}>Mover estancia</button>
          )}
        </div>
      </article>
    );
  }
  return (
    <section className="m-calendar" aria-label="Calendario móvil">
      <div className="m-screen-heading">
        <div>
          <p className="eyebrow">CADA ESTANCIA EN SU LUGAR</p>
          <h1>Calendario</h1>
          <p>{dateLabel}</p>
        </div>
        <div className="row">
          <button
            className="m-round-button"
            aria-label="Personalizar calendario"
            onClick={() => setCustomize(true)}
          >
            <Icon name="settings" />
          </button>
          <button
            className="m-round-button"
            aria-label="Filtrar calendario"
            onClick={() => setFiltering(true)}
          >
            <Icon name="filter" />
          </button>
        </div>
      </div>
      <CalendarLayoutSwitch value={layout} onChange={setLayout} />
      {layout === "multiple" && (
        <div className="m-segmented" aria-label="Vista del calendario">
          {(
            [
              ["rooms", "Habitaciones"],
              ["agenda", "Agenda"],
              ["month", "Mes"],
              ["year", "Año"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={view === key}
              className={view === key ? "active" : ""}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="m-date-toolbar">
        {scope === "organization" && (
          <span className="sr-only">Todas mis propiedades</span>
        )}
        <button
          className="m-round-button"
          aria-label="Período anterior"
          onClick={() => navigate(-1)}
        >
          <Icon name="chevron-left" />
        </button>
        <button
          className="button secondary"
          onClick={() => {
            setDate(data.today);
            setAnchor(data.today);
          }}
        >
          Hoy
        </button>
        <label className="sr-only" htmlFor="mobile-calendar-date">
          Fecha del calendario
        </label>
        <input
          id="mobile-calendar-date"
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) {
              setDate(e.target.value);
              setAnchor(e.target.value);
            }
          }}
        />
        <button
          className="m-round-button"
          aria-label="Período siguiente"
          onClick={() => navigate(1)}
        >
          <Icon name="chevron-right" />
        </button>
      </div>
      {can("reservation.write") && (
        <div className="m-calendar-actions">
          <button
            className="button secondary"
            onClick={() => setChoosing(true)}
          >
            Mover estancia
          </button>
          <button className="button primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={17} />
            Reservar
          </button>
        </div>
      )}
      {(type || source || search) && (
        <button
          className="m-filter-reset"
          onClick={() => {
            setType("");
            setSource("");
            setSearch("");
          }}
        >
          Filtros activos · Limpiar
        </button>
      )}
      {layout === "single" && (
        <SingleCalendar
          compact
          month={anchor}
          onMonth={(m) => {
            setAnchor(m);
            setDate(m);
          }}
          units={units}
          reservations={reservations}
          flash={flash}
          onRange={setRange}
          onPreview={(r) => setPreview({ ...r })}
          onBlock={setBlockId}
        />
      )}
      {layout === "multiple" && view === "rooms" && (
        <>
          {units.length > 0 && (
            <MultiCalendar
              compact
              month={anchor}
              units={units}
              reservations={reservations}
              occupancy={all}
              display={preferences.calendar}
              showProperty={scope === "organization"}
              flash={flash}
              onRange={setRange}
              onPreview={(r) => setPreview({ ...r })}
              onBlock={setBlockId}
              onMove={setMove}
            />
          )}
          {!units.length && (
            <Empty
              title="Sin unidades para mostrar"
              description="Revisa los filtros o configura el inventario de tu propiedad."
            />
          )}
        </>
      )}
      {layout === "multiple" && view === "agenda" && (
        <>
          <div className="m-week-strip" aria-label="Elegir día">
            {Array.from({ length: 7 }, (_, i) => addDays(anchor, i)).map(
              (day) => (
                <button
                  key={day}
                  className={day === date ? "active" : ""}
                  aria-pressed={day === date}
                  onClick={() => setDate(day)}
                >
                  <small>
                    {new Intl.DateTimeFormat(uiLocale(), {
                      weekday: "short",
                      timeZone: "UTC",
                    }).format(new Date(day + "T12:00:00Z"))}
                  </small>
                  <strong>{day.slice(8)}</strong>
                </button>
              ),
            )}
          </div>
          <h2 className="m-section-label">Estancias del {shortDate(date)}</h2>
          <div className="m-stay-list">{agenda.map(card)}</div>
          {!agenda.length && (
            <Empty
              title="Un día con espacio"
              description="No hay estancias que coincidan con esta fecha y los filtros."
            />
          )}
        </>
      )}
      {layout === "multiple" && view === "month" && (
        <>
          <div className="m-month-grid" aria-label="Calendario mensual">
            {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
              <span key={i} aria-hidden="true">
                {d}
              </span>
            ))}
            {monthGrid(anchor).map((day) => {
              const count = reservations.filter(
                (r) => r.arrival <= day && r.departure > day,
              ).length;
              return (
                <button
                  key={day}
                  className={`${day.slice(0, 7) !== anchor.slice(0, 7) ? "outside" : ""} ${day === date ? "selected" : ""} ${day === data.today ? "today" : ""}`}
                  aria-pressed={day === date}
                  aria-label={`${day}, ${count} estancias`}
                  onClick={() => setDate(day)}
                >
                  <strong>{day.slice(8)}</strong>
                  <small>{count ? `${count} est.` : "·"}</small>
                </button>
              );
            })}
          </div>
          <h2 className="m-section-label">Estancias del {shortDate(date)}</h2>
          <div className="m-stay-list">{agenda.map(card)}</div>
          {!agenda.length && (
            <p className="m-empty-note">No hay estancias en esta fecha.</p>
          )}
        </>
      )}
      {reservations.some((r) => !r.unitId) && (
        <section>
          <h2 className="m-section-label">Por asignar</h2>
          <div className="m-stay-list">
            {reservations.filter((r) => !r.unitId).map(card)}
          </div>
        </section>
      )}
      {selected && (
        <PropertyWorkspace
          propertyId={
            data.reservations.find((r) => r.id === selected)?.propertyId ??
            data.currentPropertyId
          }
        >
          <ReservationInspector
            id={selected}
            onClose={() => setSelected(null)}
          />
        </PropertyWorkspace>
      )}
      {layout === "multiple" && view === "year" && (
        <CalendarOverview
          view="year"
          date={anchor}
          units={units}
          source={source}
          onRange={setRange}
          onPreview={(r) => setPreview({ ...r })}
          onBlock={setBlockId}
        />
      )}
      {move && (
        <PropertyWorkspace propertyId={move.reservation.propertyId}>
          <MoveDialog
            move={move}
            onClose={() => setMove(null)}
            onDone={(id) => {
              setFlash(id);
              window.setTimeout(() => setFlash(null), 1600);
            }}
          />
        </PropertyWorkspace>
      )}
      {creating && (
        <ReservationForm
          onClose={() => {
            setCreating(false);
          }}
        />
      )}
      {choosing && (
        <Modal
          title="Elegir estancia para mover"
          onClose={() => setChoosing(false)}
        >
          <p>
            Selecciona una estancia. Podrás revisar habitación, fechas y precio
            antes de confirmar.
          </p>
          <div className="move-options">
            {reservations.filter(movable).map((r) => (
              <button
                className="button secondary"
                key={r.id}
                onClick={() => choose(r)}
              >
                {guestName(data.guests, r.guestId)} · {r.confirmationCode} ·{" "}
                {shortDate(r.arrival)}
              </button>
            ))}
          </div>
          {!reservations.some(movable) && (
            <Empty title="No hay estancias para mover" />
          )}
        </Modal>
      )}
      {preview && (
        <PropertyWorkspace propertyId={preview.propertyId}>
          <CalendarQuickView
            reservation={preview}
            onClose={() => setPreview(null)}
            onOpen={() => {
              setSelected(preview.id);
              setPreview(null);
            }}
            onMove={() => {
              setMove({
                reservation: preview,
                unitId: preview.unitId ?? "",
                arrival: preview.arrival,
              });
              setPreview(null);
            }}
          />
        </PropertyWorkspace>
      )}
      {range && (
        <PropertyWorkspace
          propertyId={
            data.units.find((u) => u.id === range.unitId)?.propertyId ??
            data.currentPropertyId
          }
        >
          <CalendarRangeDialog range={range} onClose={() => setRange(null)} />
        </PropertyWorkspace>
      )}
      {blockId && (
        <PropertyWorkspace
          propertyId={
            data.blocks.find((b) => b.id === blockId)?.propertyId ??
            data.currentPropertyId
          }
        >
          <CalendarBlockInfo id={blockId} onClose={() => setBlockId(null)} />
        </PropertyWorkspace>
      )}
      {customize && (
        <CustomizeWorkspace
          section="calendar"
          onClose={() => setCustomize(false)}
          onApply={(value) => {
            setScope(value.calendar.scope);
            setType("");
            setView(
              value.calendar.view === "timeline"
                ? "rooms"
                : value.calendar.view,
            );
          }}
        />
      )}
      {filtering && (
        <Modal title="Filtrar calendario" onClose={() => setFiltering(false)}>
          <label className="field">
            <span id={`${fieldId}-scope`}>Propiedades visibles</span>
            <select
              aria-labelledby={`${fieldId}-scope`}
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as typeof scope);
                setType("");
              }}
            >
              <option value="property">Propiedad actual</option>
              <option value="organization">Todas mis propiedades</option>
            </select>
          </label>
          <label className="field">
            <span>Buscar huésped o reserva</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="field">
            <span id={`${fieldId}-type`}>Tipo de alojamiento</span>
            <select
              aria-labelledby={`${fieldId}-type`}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">Todos</option>
              {data.inventoryTypes
                .filter(
                  (i) =>
                    scope === "organization" ||
                    i.propertyId === data.currentPropertyId,
                )
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span id={`${fieldId}-channel`}>Canal</span>
            <select
              aria-labelledby={`${fieldId}-channel`}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Todos</option>
              {[...new Set(all.map((r) => r.source))].map((s) => (
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
            Ver calendario
          </button>
        </Modal>
      )}
    </section>
  );
}

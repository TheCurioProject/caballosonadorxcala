"use client";
import { useId, useState } from "react";
import {
  PropertyWorkspace,
  useWorkspace,
} from "@/cala/features/workspace/context";
import { CustomizeWorkspace } from "@/cala/features/workspace/customize";
import {
  workspacePreferences,
  type WorkspacePreferences,
} from "@/cala/domain/workspace/preferences";
import { monthStart, shiftMonth } from "@/cala/domain/calendar/layout";
import { CalendarOverview } from "./calendar-overview";
import {
  CalendarRangeDialog,
  CalendarQuickView,
  CalendarBlockInfo,
  type CalendarRange,
} from "./calendar-actions";
import {
  SectionTitle,
  Icon,
  Empty,
  Modal,
} from "@/cala/components/ui/primitives";
import { previewMove } from "@/cala/domain/reservations/movement";
import { priceStay } from "@/cala/domain/reservations/pricing";
import type { Reservation } from "@/cala/domain/model";
import { money, shortDate } from "@/cala/lib/format";
import {
  ReservationInspector,
  ReservationTable,
  guestName,
} from "./components";
import { useI18n } from "@/cala/lib/i18n";
import { MultiCalendar } from "./multi-calendar";
import { SingleCalendar } from "./single-calendar";
import { monthLabel, useCalendarLayout } from "./calendar-shared";

export type Move = {
  reservation: Reservation;
  unitId: string;
  arrival: string;
};
const movable = (r: Reservation) =>
  ["confirmed", "pending", "checked_in"].includes(r.status);

export function Calendar() {
  const { data } = useWorkspace();
  return <PropertyCalendar key={data.currentPropertyId} />;
}

/** Smoobu-style switch between the multi-unit planner and the single view. */
export function CalendarLayoutSwitch({
  value,
  onChange,
}: {
  value: "multiple" | "single";
  onChange: (value: "multiple" | "single") => void;
}) {
  return (
    <div className="cal-layout-switch" role="radiogroup" aria-label="Tipo de calendario">
      {(
        [
          ["multiple", "Múltiple", "Todas las unidades"],
          ["single", "Individual", "Una unidad, estilo Airbnb"],
        ] as const
      ).map(([key, label, help]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          className={value === key ? "active" : ""}
          title={help}
          onClick={() => onChange(key)}
        >
          <span className={`cal-layout-icon ${key}`} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

function PropertyCalendar() {
  const fieldId = useId();
  const { data, can } = useWorkspace();
  const { t } = useI18n();
  const preferences = workspacePreferences(
    data.workspacePreferences?.find(
      (p) =>
        p.userId === data.currentUser.id &&
        p.organizationId === data.currentOrganizationId,
    )?.preferences,
  );
  const [layout, setLayout] = useCalendarLayout();
  const [view, setView] = useState(preferences.calendar.view);
  const [scope, setScope] = useState(preferences.calendar.scope);
  const [customize, setCustomize] = useState(false);
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<Reservation | null>(null);
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [start, setStart] = useState(monthStart(data.today));
  const [length, setLength] = useState<number>(preferences.calendar.days);
  const [selected, setSelected] = useState<string | null>(null);
  const [move, setMove] = useState<Move | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [choose, setChoose] = useState(false);
  const [search, setSearch] = useState("");
  const [inventoryTypeId, setInventoryTypeId] = useState("");
  const allUnits = data.units.filter(
    (u) =>
      (scope === "organization" || u.propertyId === data.currentPropertyId) &&
      u.active,
  );
  const allReservations = data.reservations.filter(
    (r) =>
      (scope === "organization" || r.propertyId === data.currentPropertyId) &&
      !["cancelled", "no_show", "draft"].includes(r.status),
  );
  const units = allUnits
    .filter(
      (u) =>
        (!inventoryTypeId || u.inventoryTypeId === inventoryTypeId) &&
        (!search ||
          `${u.name} ${data.properties.find((p) => p.id === u.propertyId)?.name ?? ""}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()) ||
          allReservations.some(
            (r) =>
              r.unitId === u.id &&
              `${guestName(data.guests, r.guestId)} ${r.confirmationCode}`
                .toLocaleLowerCase()
                .includes(search.toLocaleLowerCase()),
          )),
    )
    .sort(
      (a, b) =>
        data.properties.findIndex((p) => p.id === a.propertyId) -
        data.properties.findIndex((p) => p.id === b.propertyId),
    );
  const reservations = allReservations.filter(
    (r) => !source || r.source === source,
  );
  const step = layout === "multiple" && view === "year" ? 12 : 1;

  return (
    <>
      <SectionTitle
        eyebrow={t("UNA VISTA DE CADA ESTANCIA")}
        title={t("Calendario")}
        description={t(
          "Encuentra espacio. Organiza llegadas. Mueve estancias con confianza.",
        )}
      >
        <div className="calendar-controls">
          <button
            className="icon-button"
            aria-label="Período anterior"
            onClick={() => setStart(shiftMonth(start, -step))}
          >
            <Icon name="chevron-left" />
          </button>
          <button
            className="button secondary"
            onClick={() => setStart(monthStart(data.today))}
          >
            {t("Hoy")}
          </button>
          <label className="sr-only" htmlFor="calendar-date">
            {t("Fecha del calendario")}
          </label>
          <input
            id="calendar-date"
            type="month"
            value={start.slice(0, 7)}
            onChange={(e) => {
              if (/^\d{4}-\d{2}$/.test(e.target.value))
                setStart(`${e.target.value}-01`);
            }}
          />
          <button
            className="icon-button"
            aria-label="Período siguiente"
            onClick={() => setStart(shiftMonth(start, step))}
          >
            <Icon name="chevron-right" />
          </button>
        </div>
      </SectionTitle>
      <div className="calendar-view-tabs" aria-label="Vista de calendario">
        <CalendarLayoutSwitch value={layout} onChange={setLayout} />
        {layout === "multiple" &&
          (
            [
              ["timeline", "Habitaciones"],
              ["month", "Mes"],
              ["year", "Año"],
            ] as const
          ).map(([key, label]) => (
            <button
              className={`button ${view === key ? "primary" : "secondary"}`}
              key={key}
              aria-pressed={view === key}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        <strong className="calendar-period-label">
          {view === "year" && layout === "multiple"
            ? start.slice(0, 4)
            : monthLabel(start)}
        </strong>
        <button className="button secondary" onClick={() => setCustomize(true)}>
          <Icon name="settings" />
          Personalizar calendario
        </button>
      </div>
      {data.analyticsComplete === false && (
        <p className="notice warning" role="alert">
          La lectura contiene solo parte de las estancias. Las acciones de
          disponibilidad están detenidas para evitar datos incompletos.
        </p>
      )}
      <div className="toolbar panel calendar-toolbar">
        <label className="field">
          <span id={`${fieldId}-scope`}>Propiedades visibles</span>
          <select
            aria-labelledby={`${fieldId}-scope`}
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as typeof scope);
              setInventoryTypeId("");
            }}
          >
            <option value="property">Propiedad actual</option>
            <option value="organization">Todas mis propiedades</option>
          </select>
        </label>
        <label className="field">
          <span>Buscar unidad</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Unidad, huésped o confirmación"
          />
        </label>
        <label className="field">
          <span id={`${fieldId}-inventory`}>Inventario</span>
          <select
            aria-labelledby={`${fieldId}-inventory`}
            value={inventoryTypeId}
            onChange={(e) => setInventoryTypeId(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {data.inventoryTypes
              .filter(
                (i) =>
                  (scope === "organization" ||
                    i.propertyId === data.currentPropertyId) &&
                  i.active,
              )
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {scope === "organization"
                    ? `${data.properties.find((p) => p.id === i.propertyId)?.name} · `
                    : ""}
                  {i.name}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span id={`${fieldId}-channel`}>Canal de reserva</span>
          <select
            aria-labelledby={`${fieldId}-channel`}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">Todos los canales</option>
            {[...new Set(allReservations.map((r) => r.source))]
              .sort()
              .map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
          </select>
        </label>
        {can("reservation.write") && (
          <button className="button secondary" onClick={() => setChoose(true)}>
            Mover estancia
          </button>
        )}
      </div>
      {layout === "single" ? (
        <SingleCalendar
          month={start}
          onMonth={setStart}
          units={units}
          reservations={reservations}
          flash={flash}
          onRange={setRange}
          onPreview={(r) => setPreview({ ...r })}
          onBlock={setBlockId}
        />
      ) : view !== "timeline" ? (
        <CalendarOverview
          view={view}
          date={start}
          units={units}
          source={source}
          onRange={setRange}
          onPreview={(r) => setPreview({ ...r })}
          onBlock={setBlockId}
        />
      ) : (
        units.length > 0 && (
          <div className="panel mc-panel">
            <MultiCalendar
              month={start}
              units={units}
              reservations={reservations}
              occupancy={allReservations}
              display={preferences.calendar}
              showProperty={scope === "organization"}
              flash={flash}
              onRange={setRange}
              onPreview={(r) => setPreview({ ...r })}
              onBlock={setBlockId}
              onMove={setMove}
            />
          </div>
        )
      )}
      {!units.length && (
        <Empty
          title="Tu calendario está por comenzar"
          description={
            allUnits.length
              ? "No hay unidades que coincidan con los filtros."
              : "Crea unidades en inventario para verlas aquí."
          }
        />
      )}
      {reservations.some((r) => !r.unitId) && (
        <div className="panel padded">
          <h3>Reservas por asignar</h3>
          <ReservationTable
            reservations={reservations.filter((r) => !r.unitId)}
            onSelect={setSelected}
          />
        </div>
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
      {choose && (
        <Modal
          title="Elegir estancia para mover"
          onClose={() => setChoose(false)}
        >
          <p>
            Selecciona una estancia. Podrás cambiar su habitación y revisar la
            disponibilidad antes de confirmar.
          </p>
          <div className="move-options">
            {reservations.filter(movable).map((r) => (
              <button
                className="button secondary"
                key={r.id}
                onClick={() => {
                  setChoose(false);
                  setMove({
                    reservation: { ...r },
                    unitId: r.unitId ?? "",
                    arrival: r.arrival,
                  });
                }}
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
          calendar={{
            view,
            scope,
            days: length as WorkspacePreferences["calendar"]["days"],
          }}
          onClose={() => setCustomize(false)}
          onApply={(value) => {
            setView(value.calendar.view);
            setScope(value.calendar.scope);
            setLength(value.calendar.days);
          }}
        />
      )}
    </>
  );
}

export function MoveDialog({
  move,
  onClose,
  onDone,
}: {
  move: Move;
  onClose: () => void;
  /** Called after the server accepted the move (for confirmation motion). */
  onDone?: (reservationId: string) => void;
}) {
  const { data, can, command } = useWorkspace();
  const [unitId, setUnitId] = useState(move.unitId);
  const [arrival, setArrival] = useState(move.arrival);
  const [pricing, setPricing] = useState<"preserve" | "recalculate">(
    "preserve",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const r = move.reservation;
  const stale =
    data.reservations.find((x) => x.id === r.id)?.version !== r.version;
  let next: Reservation | undefined,
    problem = "",
    total = r.totalMinor;
  try {
    next = previewMove(data, r, unitId, arrival);
    if (pricing === "recalculate")
      total = priceStay(
        data,
        r.propertyId,
        next.inventoryTypeId,
        r.ratePlanId,
        next.arrival,
        next.departure,
      ).totalMinor;
  } catch (e) {
    problem = e instanceof Error ? e.message : "No disponible";
  }
  const noChange = unitId === r.unitId && arrival === r.arrival;
  return (
    <Modal
      title="Confirmar movimiento"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>
        <strong>{guestName(data.guests, r.guestId)}</strong> ·{" "}
        {r.confirmationCode}
      </p>
      <p className="muted">
        Actual:{" "}
        {data.units.find((u) => u.id === r.unitId)?.name ?? "Sin asignar"} ·{" "}
        {shortDate(r.arrival)} — {shortDate(r.departure)}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!next || stale || busy || noChange) return;
          setBusy(true);
          setError("");
          try {
            await command({
              type: "reservation.move",
              id: r.id,
              version: r.version,
              unitId,
              arrival: next.arrival,
              departure: next.departure,
              pricing,
            });
            onDone?.(r.id);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo mover.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>Habitación de destino</span>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            required
          >
            <option value="">Selecciona una unidad</option>
            {data.units
              .filter((u) => u.propertyId === r.propertyId && u.active)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ·{" "}
                  {
                    data.inventoryTypes.find((i) => i.id === u.inventoryTypeId)
                      ?.name
                  }
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span>Llegada propuesta</span>
          <input
            type="date"
            required
            value={arrival}
            disabled={r.status === "checked_in"}
            onChange={(e) => setArrival(e.target.value)}
          />
        </label>
        <p>
          Salida propuesta:{" "}
          <strong>{next ? shortDate(next.departure) : "—"}</strong>. Se conserva
          la duración de la estancia.
        </p>
        <label className="field">
          <span>Precio de alojamiento</span>
          <select
            value={pricing}
            onChange={(e) => setPricing(e.target.value as typeof pricing)}
          >
            <option value="preserve">Conservar precio acordado</option>
            {can("finance.write") && (
              <option value="recalculate">
                Recalcular con las tarifas de destino
              </option>
            )}
          </select>
        </label>
        {can("finance.read") && (
          <p>
            Total: <strong>{money(total, r.currency)}</strong>
            {total !== r.totalMinor &&
              ` · Antes: ${money(r.totalMinor, r.currency)}`}
          </p>
        )}
        {!["direct", "website", "imported"].includes(r.source) && (
          <div className="notice">
            El traslado se registra en CALA. Cualquier cambio contractual de una
            reserva OTA debe confirmarse también con su canal.
          </div>
        )}
        {r.status === "checked_in" && (
          <div className="notice">
            La habitación anterior quedará pendiente de limpieza.
          </div>
        )}
        {(problem || stale || error) && (
          <div className="notice error" role="alert">
            {stale
              ? "La reserva cambió mientras revisabas el movimiento. Cierra y vuelve a abrir para revisar la versión actual."
              : error || problem}
          </div>
        )}
        <button
          className="button primary"
          type="submit"
          disabled={busy || Boolean(problem) || stale || noChange}
        >
          {busy ? "Comprobando…" : "Confirmar movimiento"}
        </button>
      </form>
    </Modal>
  );
}

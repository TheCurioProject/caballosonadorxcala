"use client";
import { useId, useState } from "react";
import { uiLocale } from "@/cala/lib/format";
import { Modal, Empty } from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import type { Reservation, Unit } from "@/cala/domain/model";
import {
  monthStart,
  monthGrid,
  unitOccupancy,
} from "@/cala/domain/calendar/layout";
import { addDays } from "@/cala/domain/shared/dates";
import { guestName } from "./components";
import type { CalendarRange } from "./calendar-actions";
import { shortDate } from "@/cala/lib/format";

export function CalendarOverview({
  view,
  date,
  units,
  source,
  onRange,
  onPreview,
  onBlock,
}: {
  view: "month" | "year";
  date: string;
  units: Unit[];
  source: string;
  onRange: (range: CalendarRange) => void;
  onPreview: (reservation: Reservation) => void;
  onBlock: (id: string) => void;
}) {
  const fieldId = useId();
  const { data, can } = useWorkspace();
  const [unitId, setUnitId] = useState(units[0]?.id ?? ""),
    [selected, setSelected] = useState<string | null>(null);
  const unit = units.find((u) => u.id === unitId) ?? units[0];
  const months =
    view === "year"
      ? Array.from(
          { length: 12 },
          (_, i) => `${date.slice(0, 4)}-${String(i + 1).padStart(2, "0")}-01`,
        )
      : [monthStart(date)];
  if (!unit)
    return (
      <Empty
        title="Sin unidades para esta vista"
        description="Revisa los filtros o configura el inventario."
      />
    );
  const occupancy = selected
    ? unitOccupancy(data, unit.id, selected, addDays(selected, 1))
    : null;
  return (
    <>
      <label className="field calendar-unit-picker">
        <span id={fieldId}>Unidad del calendario</span>
        <select
          aria-labelledby={fieldId}
          value={unit.id}
          onChange={(e) => setUnitId(e.target.value)}
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {data.properties.find((p) => p.id === u.propertyId)?.name} ·{" "}
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <div
        className={view === "year" ? "calendar-year" : "calendar-month"}
        role="group"
        aria-label={view === "year" ? "Calendario anual" : "Calendario mensual"}
      >
        {months.map((month) => (
          <section className="calendar-month-card panel" key={month}>
            <h2>
              {new Intl.DateTimeFormat(uiLocale(), {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(month + "T12:00:00Z"))}
            </h2>
            <div className="calendar-month-days">
              {["L", "M", "X", "J", "V", "S", "D"].map((day, i) => (
                <span aria-hidden="true" key={i}>
                  {day}
                </span>
              ))}
              {monthGrid(month).map((day) => {
                const held = unitOccupancy(data, unit.id, day, addDays(day, 1));
                const matching = held.reservations.filter(
                  (r) => !source || r.source === source,
                );
                const occupied = held.reservations.length > 0,
                  blocked = held.blocks.length > 0;
                return (
                  <button
                    key={day}
                    tabIndex={day === month ? 0 : -1}
                    onKeyDown={(event) => {
                      const cells = Array.from(
                        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                          "button",
                        ) ?? [],
                      );
                      const index = cells.indexOf(event.currentTarget);
                      const delta = {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -7,
                        ArrowDown: 7,
                      }[event.key];
                      const target =
                        delta !== undefined
                          ? index + delta
                          : event.key === "Home"
                            ? index - (index % 7)
                            : event.key === "End"
                              ? index + 6 - (index % 7)
                              : -1;
                      if (target < 0 || target >= cells.length) return;
                      event.preventDefault();
                      cells.forEach((cell, i) => {
                        cell.tabIndex = i === target ? 0 : -1;
                      });
                      cells[target].focus();
                    }}
                    onClick={() => setSelected(day)}
                    className={`${day.slice(0, 7) !== month.slice(0, 7) ? "outside" : ""} ${occupied ? "occupied" : ""} ${blocked ? "blocked" : ""} ${day === data.today ? "today" : ""}`}
                    aria-label={`${day}, ${matching.length} estancias coincidentes${occupied ? ", ocupado" : ""}${blocked ? ", bloqueado" : ""}`}
                  >
                    <strong>{Number(day.slice(8))}</strong>
                    <small>
                      {blocked
                        ? "Bloq."
                        : matching.length
                          ? `${matching.length} est.`
                          : occupied
                            ? "Ocup."
                            : "·"}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <p className="muted calendar-view-note">
        Toca una fecha para revisar sus estancias. La salida es el primer día
        disponible; los filtros no liberan inventario ocupado.
      </p>
      {selected && occupancy && (
        <Modal
          title={`Estancias del ${shortDate(selected)}`}
          onClose={() => setSelected(null)}
        >
          <p>
            <strong>{unit.name}</strong> ·{" "}
            {data.properties.find((p) => p.id === unit.propertyId)?.name}
          </p>
          <div className="move-options">
            {occupancy.reservations.map((r) => (
              <button
                className="button secondary"
                key={r.id}
                onClick={() => {
                  setSelected(null);
                  onPreview({ ...r });
                }}
              >
                {guestName(data.guests, r.guestId)} · {r.confirmationCode}
              </button>
            ))}
            {occupancy.blocks.map((b) => (
              <button
                className="button secondary"
                key={b.id}
                onClick={() => {
                  setSelected(null);
                  onBlock(b.id);
                }}
              >
                Bloqueo · {b.reason}
              </button>
            ))}
          </div>
          {!occupancy.reservations.length && !occupancy.blocks.length && (
            <p>
              Sin estancias asignadas ni bloqueos visibles en esta fecha. La
              disponibilidad se confirma al guardar.
            </p>
          )}
          {(can("reservation.write") || can("inventory.write")) && (
            <button
              className="button primary"
              disabled={
                data.analyticsComplete === false ||
                occupancy.reservations.length > 0 ||
                occupancy.blocks.length > 0
              }
              onClick={() => {
                setSelected(null);
                onRange({
                  unitId: unit.id,
                  arrival: selected,
                  departure: addDays(selected, 1),
                });
              }}
            >
              Reservar o bloquear
            </button>
          )}
        </Modal>
      )}
    </>
  );
}

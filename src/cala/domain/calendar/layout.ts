import type { Snapshot } from "../model";
import { addDays, isDate, overlaps } from "../shared/dates";
import { invariant } from "../shared/errors";
import { unitsConflict } from "../inventory/availability";
export function monthStart(value: string) {
  invariant(isDate(value), "INVALID_DATES", "Fecha inválida");
  return value.slice(0, 7) + "-01";
}
export function shiftMonth(value: string, delta: number) {
  const date = new Date(monthStart(value) + "T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 10);
}
export function monthGrid(value: string) {
  const first = monthStart(value),
    weekday = (new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => addDays(first, i - weekday));
}
export function calendarSegment(
  arrival: string,
  departure: string,
  start: string,
  length: number,
) {
  const first = Math.max(0, dayDistance(start, arrival)),
    last = Math.min(length, dayDistance(start, departure));
  return last > first ? { first, span: last - first } : null;
}
export function dayDistance(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
/** Both cells are selected; a reservation's checkout remains exclusive. */
export function selectionRange(a: string, b: string) {
  invariant(
    isDate(a) && isDate(b),
    "INVALID_DATES",
    "Selecciona fechas válidas.",
  );
  return { arrival: a < b ? a : b, departure: addDays(a < b ? b : a, 1) };
}
export function unitOccupancy(
  data: Pick<
    Snapshot,
    "properties" | "inventoryTypes" | "units" | "reservations" | "blocks"
  >,
  unitId: string,
  arrival: string,
  departure: string,
) {
  const unit = data.units.find((u) => u.id === unitId);
  return {
    reservations: data.reservations.filter(
      (r) =>
        unit &&
        r.propertyId === unit.propertyId &&
        r.unitId &&
        !["draft", "cancelled", "no_show"].includes(r.status) &&
        overlaps(arrival, departure, r.arrival, r.departure) &&
        unitsConflict(data, unitId, r.unitId),
    ),
    blocks: data.blocks.filter(
      (b) =>
        unit &&
        b.propertyId === unit.propertyId &&
        b.active &&
        overlaps(arrival, departure, b.arrival, b.departure) &&
        unitsConflict(data, unitId, b.unitId),
    ),
  };
}

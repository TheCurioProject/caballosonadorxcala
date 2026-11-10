import type { Reservation } from "../model";
import {
  assertInventory,
  type InventoryState,
} from "../inventory/availability";
import { addDays, nights } from "../shared/dates";
import { invariant } from "../shared/errors";

export function shiftedArrival(
  arrival: string,
  grabbedDate: string,
  droppedDate: string,
) {
  const delta = Math.round(
    (Date.parse(droppedDate) - Date.parse(grabbedDate)) / 86400000,
  );
  return addDays(arrival, delta);
}

/** Preview is advisory. The server rechecks everything under the inventory lock. */
export function previewMove(
  state: InventoryState,
  reservation: Reservation,
  unitId: string,
  arrival: string,
) {
  const unit = state.units.find(
    (u) =>
      u.id === unitId && u.active && u.propertyId === reservation.propertyId,
  );
  invariant(
    unit,
    "INVALID_UNIT",
    "Selecciona una unidad activa de esta propiedad.",
  );
  invariant(
    ["pending", "confirmed", "checked_in"].includes(reservation.status),
    "INVALID_TRANSITION",
    "Esta estancia ya no se puede mover.",
  );
  const departure = addDays(
    arrival,
    nights(reservation.arrival, reservation.departure).length,
  );
  invariant(
    reservation.status !== "checked_in" || arrival === reservation.arrival,
    "IN_HOUSE_DATES",
    "Una estancia en casa conserva sus fechas.",
  );
  invariant(
    reservation.status !== "checked_in" || unit.housekeeping !== "dirty",
    "ROOM_NOT_READY",
    "La unidad necesita limpieza antes del traslado.",
  );
  const next = {
    ...reservation,
    unitId,
    inventoryTypeId: unit.inventoryTypeId,
    arrival,
    departure,
  };
  assertInventory(state, next);
  return next;
}

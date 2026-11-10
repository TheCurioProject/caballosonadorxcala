import type { Reservation, State } from "../model";
import { nights, overlaps } from "../shared/dates";
import { invariant } from "../shared/errors";
export type InventoryState = Pick<
  State,
  "units" | "blocks" | "reservations" | "inventoryTypes" | "properties"
>;
export const consuming = (r: Reservation) =>
  ["pending", "confirmed", "checked_in", "checked_out"].includes(r.status);
export function resources(s: InventoryState, unitId: string): Set<string> {
  const children = s.units.filter((u) => u.parentUnitId === unitId && u.active);
  return new Set(
    children.length
      ? children.flatMap((u) => [...resources(s, u.id)])
      : [unitId],
  );
}
export function unitsConflict(s: InventoryState, a: string, b: string) {
  const left = resources(s, a);
  return [...resources(s, b)].some((id) => left.has(id));
}
export function unitAvailable(
  s: InventoryState,
  unitId: string,
  arrival: string,
  departure: string,
  excludeId?: string,
) {
  return (
    !s.blocks.some(
      (b) =>
        b.active &&
        overlaps(arrival, departure, b.arrival, b.departure) &&
        unitsConflict(s, unitId, b.unitId),
    ) &&
    !s.reservations.some(
      (r) =>
        r.id !== excludeId &&
        r.unitId &&
        consuming(r) &&
        overlaps(arrival, departure, r.arrival, r.departure) &&
        unitsConflict(s, unitId, r.unitId),
    )
  );
}
export function availability(
  s: InventoryState,
  inventoryTypeId: string,
  arrival: string,
  departure: string,
  excludeId?: string,
) {
  const days = nights(arrival, departure);
  const type = s.inventoryTypes.find(
    (t) => t.id === inventoryTypeId && t.active,
  );
  invariant(
    type,
    "INVENTORY_NOT_FOUND",
    "Selecciona un tipo de inventario válido.",
  );
  const p = s.properties.find((p) => p.id === type.propertyId)!;
  const units = s.units.filter(
    (u) => u.inventoryTypeId === inventoryTypeId && u.active,
  );
  const availableUnits = units.filter((u) =>
    unitAvailable(s, u.id, arrival, departure, excludeId),
  );
  const daily = days.map((date) => {
    const next = new Date(Date.parse(date) + 86400000)
      .toISOString()
      .slice(0, 10);
    const free = units.filter((u) =>
      unitAvailable(s, u.id, date, next, excludeId),
    ).length;
    const unassigned = s.reservations.filter(
      (r) =>
        r.id !== excludeId &&
        r.inventoryTypeId === inventoryTypeId &&
        !r.unitId &&
        consuming(r) &&
        overlaps(date, next, r.arrival, r.departure),
    ).length;
    return {
      date,
      capacity: units.length,
      available: free - unassigned + p.allowedOverbooking,
    };
  });
  return {
    units: availableUnits,
    daily,
    available: Math.min(...daily.map((d) => d.available)),
  };
}
export function assertInventory(s: InventoryState, r: Reservation) {
  nights(r.arrival, r.departure);

  const type = s.inventoryTypes.find(
    (t) =>
      t.id === r.inventoryTypeId && t.propertyId === r.propertyId && t.active,
  );
  invariant(
    type,
    "INVALID_INVENTORY",
    "El inventario no pertenece a esta propiedad.",
  );
  invariant(
    r.adults + r.children <= type.maxOccupancy,
    "OCCUPANCY",
    "La ocupación supera la capacidad.",
  );
  if (r.unitId)
    invariant(
      s.units.some(
        (u) =>
          u.id === r.unitId &&
          u.propertyId === r.propertyId &&
          u.inventoryTypeId === type.id &&
          u.active,
      ),
      "INVALID_UNIT",
      "La unidad no pertenece al inventario seleccionado.",
    );
  if (!consuming(r)) return;
  invariant(
    r.unitId ||
      !s.units.some(
        (u) =>
          u.inventoryTypeId === type.id &&
          (u.parentUnitId ||
            s.units.some((child) => child.parentUnitId === u.id)),
      ),
    "COMPOSITE_UNIT_REQUIRED",
    "Asigna una unidad para reservar inventario compuesto de habitaciones y camas.",
  );
  const available = availability(s, type.id, r.arrival, r.departure, r.id);
  invariant(
    available.available > 0,
    "NO_AVAILABILITY",
    "No hay disponibilidad para todas las noches de la estancia.",
    409,
  );
  if (r.unitId) {
    const unit = s.units.find(
      (u) => u.id === r.unitId && u.inventoryTypeId === type.id && u.active,
    );
    invariant(
      unit,
      "INVALID_UNIT",
      "La unidad no pertenece al inventario seleccionado.",
    );
    invariant(
      unitAvailable(s, unit.id, r.arrival, r.departure, r.id),
      "UNIT_CONFLICT",
      "La unidad o uno de sus espacios relacionados ya está ocupado o bloqueado.",
      409,
    );
  }
}

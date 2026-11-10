import type { State } from "../model";
import { nights } from "../shared/dates";
import { invariant } from "../shared/errors";
export function priceStay(
  s: Pick<State, "properties" | "inventoryTypes" | "ratePlans" | "rateDays">,
  propertyId: string,
  inventoryTypeId: string,
  ratePlanId: string,
  arrival: string,
  departure: string,
) {
  const days = nights(arrival, departure);
  const type = s.inventoryTypes.find(
    (t) => t.id === inventoryTypeId && t.propertyId === propertyId,
  );
  const plan = s.ratePlans.find(
    (p) => p.id === ratePlanId && p.propertyId === propertyId && p.active,
  );
  const property = s.properties.find((p) => p.id === propertyId);
  invariant(
    type && plan && property,
    "INVALID_RATE",
    "Selecciona inventario y tarifa de la misma propiedad.",
  );
  let subtotal = 0;
  for (const date of days) {
    const day = s.rateDays.find(
      (d) =>
        d.inventoryTypeId === inventoryTypeId &&
        d.ratePlanId === ratePlanId &&
        d.date === date,
    );
    if (day) {
      invariant(
        !day.closed,
        "RATE_CLOSED",
        "La tarifa está cerrada en una de las noches.",
      );
      invariant(
        days.length >= day.minStay && days.length <= day.maxStay,
        "STAY_RESTRICTION",
        `La estancia debe cumplir el mínimo de ${day.minStay} y máximo de ${day.maxStay} noches.`,
      );
      if (date === arrival)
        invariant(
          !day.cta,
          "ARRIVAL_CLOSED",
          "No se permiten llegadas en esa fecha.",
        );
    }
    subtotal += day?.amountMinor ?? type.baseRateMinor;
  }
  const departureRate = s.rateDays.find(
    (d) =>
      d.inventoryTypeId === inventoryTypeId &&
      d.ratePlanId === ratePlanId &&
      d.date === departure,
  );
  invariant(
    !departureRate?.ctd,
    "DEPARTURE_CLOSED",
    "No se permiten salidas en esa fecha.",
  );
  const tax = Number(
    (BigInt(subtotal) * BigInt(property.taxBps) + 5000n) / 10000n,
  );
  invariant(
    Number.isSafeInteger(subtotal + tax),
    "AMOUNT_OVERFLOW",
    "El importe supera el límite admitido.",
  );
  return {
    subtotalMinor: subtotal,
    taxMinor: tax,
    totalMinor: subtotal + tax,
    nights: days.length,
  };
}

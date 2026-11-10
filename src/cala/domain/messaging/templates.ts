import type { Guest, Property, Reservation, Unit } from "../model";
import { invariant } from "../shared/errors";
export const messageVariables = [
  "guest_first_name",
  "guest_name",
  "property_name",
  "arrival",
  "departure",
  "check_in",
  "check_out",
  "confirmation_code",
  "unit_name",
] as const;
export function validateTemplate(body: string) {
  for (const match of body.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g))
    invariant(
      messageVariables.includes(match[1] as (typeof messageVariables)[number]),
      "UNKNOWN_VARIABLE",
      `Variable de mensaje desconocida: ${match[1]}`,
    );
  const withoutVariables = body.replace(/\{\{\s*[^{}]+?\s*\}\}/g, "");
  invariant(
    !withoutVariables.includes("{{") && !withoutVariables.includes("}}"),
    "INVALID_VARIABLE",
    "Revisa las llaves de las variables del mensaje.",
  );
}
export function renderMessage(
  body: string,
  context: {
    guest?: Guest;
    property: Property;
    reservation: Reservation;
    unit?: Unit;
  },
) {
  validateTemplate(body);
  const { guest, property, reservation, unit } = context;
  const values: Record<(typeof messageVariables)[number], string> = {
    guest_first_name: guest?.firstName ?? "",
    guest_name: guest ? `${guest.firstName} ${guest.lastName}` : "",
    property_name: property.name,
    arrival: reservation.arrival,
    departure: reservation.departure,
    check_in: property.checkIn,
    check_out: property.checkOut,
    confirmation_code: reservation.confirmationCode,
    unit_name: unit?.name ?? "",
  };
  return body.replace(
    /\{\{\s*([^{}]+?)\s*\}\}/g,
    (_, key: string) => values[key as keyof typeof values],
  );
}

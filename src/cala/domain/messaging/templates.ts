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
  "nights",
  "guest_count",
] as const;
export type MessageVariable = (typeof messageVariables)[number];
export type MessageValues = Record<MessageVariable, string>;
const VARIABLE = /\{\{\s*([^{}]+?)\s*\}\}/g;
export function validateTemplate(body: string) {
  for (const match of body.matchAll(VARIABLE))
    invariant(
      messageVariables.includes(match[1] as MessageVariable),
      "UNKNOWN_VARIABLE",
      `Variable de mensaje desconocida: ${match[1]}`,
    );
  const withoutVariables = body.replace(VARIABLE, "");
  invariant(
    !withoutVariables.includes("{{") && !withoutVariables.includes("}}"),
    "INVALID_VARIABLE",
    "Revisa las llaves de las variables del mensaje.",
  );
}
function nightsBetween(arrival: string, departure: string) {
  const a = Date.parse(`${arrival}T00:00:00Z`),
    d = Date.parse(`${departure}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(d)
    ? String(Math.max(0, Math.round((d - a) / 86400000)))
    : "";
}
/** Dates written for the guest ("viernes, 28 de noviembre de 2026"). */
export function guestDate(date: string, locale: string) {
  const t = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(t)) return date;
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(t);
  } catch {
    return date;
  }
}
/** Plain values of every variable. With `locale`, dates are written out. */
export function messageValues(
  input: {
    guest?: { firstName: string; lastName: string };
    propertyName: string;
    checkIn: string;
    checkOut: string;
    arrival: string;
    departure: string;
    confirmationCode: string;
    unitName?: string | null;
    adults: number;
    children: number;
  },
  locale?: string,
): MessageValues {
  const date = (d: string) => (locale ? guestDate(d, locale) : d);
  return {
    guest_first_name: input.guest?.firstName ?? "",
    guest_name: input.guest
      ? `${input.guest.firstName} ${input.guest.lastName}`.trim()
      : "",
    property_name: input.propertyName,
    arrival: date(input.arrival),
    departure: date(input.departure),
    check_in: input.checkIn,
    check_out: input.checkOut,
    confirmation_code: input.confirmationCode,
    unit_name: input.unitName ?? "",
    nights: nightsBetween(input.arrival, input.departure),
    guest_count: String(input.adults + input.children),
  };
}
/** Single pass: guest-written values are never expanded again. */
export function fillVariables(
  text: string,
  values: MessageValues,
  encode: (v: string) => string = (v) => v,
) {
  validateTemplate(text);
  return text.replace(VARIABLE, (_, key: string) =>
    encode(values[key as MessageVariable] ?? ""),
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
  locale?: string,
) {
  const { guest, property, reservation, unit } = context;
  return fillVariables(
    body,
    messageValues(
      {
        guest,
        propertyName: property.name,
        checkIn: property.checkIn,
        checkOut: property.checkOut,
        arrival: reservation.arrival,
        departure: reservation.departure,
        confirmationCode: reservation.confirmationCode,
        unitName: unit?.name,
        adults: reservation.adults,
        children: reservation.children,
      },
      locale,
    ),
  );
}

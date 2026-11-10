import { invariant } from "./errors";
export function isDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function addDays(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function nights(arrival: string, departure: string) {
  invariant(
    isDate(arrival) && isDate(departure) && departure > arrival,
    "INVALID_DATES",
    "La salida debe ser posterior a la llegada.",
  );
  const count = Math.round(
    (Date.parse(departure) - Date.parse(arrival)) / 86400000,
  );
  invariant(
    count <= 730,
    "STAY_TOO_LONG",
    "La estancia no puede superar 730 noches.",
  );
  return Array.from({ length: count }, (_, i) => addDays(arrival, i));
}
export function overlaps(a: string, b: string, c: string, d: string) {
  return a < d && c < b;
}
export function today(timezone = "America/Mexico_City") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

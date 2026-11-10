import { invariant } from "../shared/errors";
import { isDate, nights } from "../shared/dates";
export interface CalendarEvent {
  uid: string;
  arrival: string;
  departure: string;
  sequence: number;
  stamp: string;
  cancelled: boolean;
  own: boolean;
}
export function parseCalendar(text: string): CalendarEvent[] {
  invariant(
    text.length <= 100000 &&
      text.includes("BEGIN:VCALENDAR") &&
      text.includes("END:VCALENDAR"),
    "INVALID_CALENDAR",
    "El calendario no es válido o supera 100 KB.",
  );
  const events: CalendarEvent[] = [];
  let fields: Map<string, string> | null = null;
  for (const line of text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/)) {
    if (line === "BEGIN:VEVENT") {
      invariant(!fields, "INVALID_CALENDAR", "Evento anidado no válido.");
      fields = new Map();
      continue;
    }
    if (line === "END:VEVENT" && fields) {
      const uid = fields.get("UID") ?? "",
        a = fields.get("DTSTART;VALUE=DATE") ?? "",
        b = fields.get("DTEND;VALUE=DATE") ?? "";
      invariant(
        uid.length > 0 && uid.length <= 200 && !/[\r\n]/.test(uid),
        "INVALID_UID",
        "Cada evento necesita un UID estable.",
      );
      invariant(
        !fields.has("RRULE") &&
          !fields.has("RECURRENCE-ID") &&
          /^\d{8}$/.test(a) &&
          /^\d{8}$/.test(b),
        "UNSUPPORTED_CALENDAR",
        "Sólo se admiten estancias de día completo con inicio y fin; no recurrencias ni horarios.",
      );
      const date = (v: string) =>
        `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
      const arrival = date(a),
        departure = date(b);
      invariant(
        isDate(arrival) && isDate(departure),
        "INVALID_DATE",
        "Fecha iCal inválida.",
      );
      nights(arrival, departure);
      const sequence = Number(fields.get("SEQUENCE") ?? 0);
      invariant(
        Number.isSafeInteger(sequence) && sequence >= 0,
        "INVALID_SEQUENCE",
        "Secuencia inválida.",
      );
      events.push({
        uid,
        arrival,
        departure,
        sequence,
        stamp: fields.get("LAST-MODIFIED") ?? fields.get("DTSTAMP") ?? "",
        cancelled: fields.get("STATUS") === "CANCELLED",
        own:
          uid.endsWith("@cala.local") || fields.get("X-CALA-ORIGIN") === "CALA",
      });
      fields = null;
    } else if (fields) {
      const i = line.indexOf(":");
      if (i > 0) fields.set(line.slice(0, i), line.slice(i + 1));
    }
  }
  invariant(
    !fields && events.length <= 200,
    "INVALID_CALENDAR",
    "Calendario incompleto o con más de 200 eventos.",
  );
  return events;
}
export function exportCalendar(events: CalendarEvent[], stamp: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CALA//Hospitality PMS//ES",
    "CALSCALE:GREGORIAN",
  ];
  for (const e of events)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTART;VALUE=DATE:${e.arrival.replaceAll("-", "")}`,
      `DTEND;VALUE=DATE:${e.departure.replaceAll("-", "")}`,
      `SEQUENCE:${e.sequence}`,
      `DTSTAMP:${stamp}`,
      `LAST-MODIFIED:${e.stamp || stamp}`,
      `STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`,
      "SUMMARY:No disponible",
      "X-CALA-ORIGIN:CALA",
      "END:VEVENT",
    );
  return [...lines, "END:VCALENDAR", ""].join("\r\n");
}

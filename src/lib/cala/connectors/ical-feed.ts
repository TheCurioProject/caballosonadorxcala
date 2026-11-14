import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { DomainError } from "@/cala/domain/shared/errors";

export type CalendarProvider = "airbnb" | "booking" | "expedia" | "vrbo" | "other";
export const calendarProviders: CalendarProvider[] = [
  "airbnb",
  "booking",
  "vrbo",
  "expedia",
  "other",
];

export interface OtaCalendarEvent {
  uid: string;
  arrival: string;
  departure: string;
  cancelled: boolean;
  summary: string;
  /**
   * "reservation": a real booking, must close the dates in CALA.
   * "unavailable": the OTA only says "not bookable here" (Airbnb's
   * "Airbnb (Not available)"): manual blocks, booking-window / notice rules,
   * linked listings or dates another channel manager closed. It is NOT a
   * booking and must never block CALA: on a whole-house listing those marks
   * mirror the nights when any room is taken, so importing them closes every
   * room of the house.
   */
  kind: "reservation" | "unavailable";
}

/** Only Airbnb tells bookings and availability marks apart in its feed. */
export function eventKind(uid: string, summary: string, description: string): OtaCalendarEvent["kind"] {
  const airbnb = /@airbnb\.[a-z.]+$/i.test(uid) || /^airbnb\b/i.test(summary);
  if (!airbnb) return "reservation";
  if (/reservation url|\/hosting\/reservations\//i.test(description)) return "reservation";
  return /not available|no disponible|unavailable|blocked/i.test(summary) ? "unavailable" : "reservation";
}

/** Events that must close dates in CALA. */
export const bookedEvents = (events: OtaCalendarEvent[]) => events.filter((e) => e.kind === "reservation");

const hostProviders: [RegExp, CalendarProvider][] = [
  [/(^|\.)airbnb\.[a-z.]+$/, "airbnb"],
  [/(^|\.)booking\.com$/, "booking"],
  [/(^|\.)(vrbo|homeaway|abritel|fewo-direkt|stayz|bookabach)\.[a-z.]+$/, "vrbo"],
  [/(^|\.)(expedia|expediapartnercentral|hotels)\.[a-z.]+$/, "expedia"],
];

/** Which OTA a calendar URL belongs to, from its host. */
export function providerForUrl(url: string): CalendarProvider | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return hostProviders.find(([re]) => re.test(host))?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Identity of an OTA calendar regardless of the country domain it was copied
 * from (airbnb.com and airbnb.mx serve the same feed): used to detect that two
 * importers read the same calendar.
 */
export function calendarIdentity(raw: string) {
  const text = raw.trim().replace(/^webcal:\/\//i, "https://");
  try {
    const url = new URL(text);
    const provider = providerForUrl(text);
    const path = url.pathname.replace(/\/+$/, "") + url.search;
    return provider ? `${provider}:${path}` : `${url.hostname.toLowerCase()}${path}`;
  } catch {
    return text.replace(/\/+$/, "");
  }
}

function fail(code: string, message: string): never {
  throw new DomainError(code, message, 422);
}

function privateAddress(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return (
      v === "::1" ||
      v === "::" ||
      v.startsWith("fc") ||
      v.startsWith("fd") ||
      v.startsWith("fe80") ||
      v.startsWith("::ffff:127.") ||
      v.startsWith("::ffff:10.") ||
      v.startsWith("::ffff:192.168.")
    );
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/** Only public HTTPS hosts: the server must never be used to reach private networks. */
async function assertPublicHttps(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    fail("INVALID_CALENDAR_URL", "Eso no parece un enlace. Copia el enlace completo, empieza por https://");
  }
  if (url.protocol === "webcal:") url = new URL(raw.trim().replace(/^webcal:/i, "https:"));
  if (url.protocol !== "https:")
    fail("INVALID_CALENDAR_URL", "El enlace debe empezar por https://");
  if (url.username || url.password || (url.port && url.port !== "443"))
    fail("INVALID_CALENDAR_URL", "El enlace no es un calendario público válido.");
  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal"))
    fail("INVALID_CALENDAR_URL", "El enlace no es un calendario público válido.");
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() =>
        fail("CALENDAR_UNREACHABLE", `No encontramos el servidor «${host}». Revisa que el enlace esté completo.`),
      );
  if (!addresses.length || addresses.some((a) => privateAddress(a.address)))
    fail("INVALID_CALENDAR_URL", "El enlace no es un calendario público válido.");
  return url;
}

export function normalizeCalendarUrl(raw: string) {
  return raw.trim().replace(/^webcal:\/\//i, "https://");
}

/** Downloads an iCal feed with redirects re-validated, a timeout and a size cap. */
export async function fetchCalendar(raw: string): Promise<string> {
  let url = await assertPublicHttps(normalizeCalendarUrl(raw));
  for (let hop = 0; hop < 4; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "CALA-Calendar-Sync/1.0 (+https://casacaballosonador.com)",
          Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1",
        },
        cache: "no-store",
      });
    } catch (error) {
      clearTimeout(timer);
      if ((error as Error).name === "AbortError")
        fail("CALENDAR_TIMEOUT", "El calendario tardó más de 15 segundos en responder. Inténtalo de nuevo.");
      fail("CALENDAR_UNREACHABLE", "No pudimos conectar con el servidor del calendario.");
    }
    if (response.status >= 300 && response.status < 400) {
      clearTimeout(timer);
      const next = response.headers.get("location");
      if (!next) fail("CALENDAR_UNREACHABLE", "El calendario redirige a una dirección vacía.");
      url = await assertPublicHttps(new URL(next, url).toString());
      continue;
    }
    if (response.status === 401 || response.status === 403 || response.status === 404 || response.status === 410)
      fail(
        "CALENDAR_NOT_FOUND",
        "La OTA respondió que el enlace no existe o ya no es válido. Copia de nuevo el enlace de exportación.",
      );
    if (!response.ok)
      fail("CALENDAR_UNREACHABLE", `El servidor del calendario respondió con un error (${response.status}). Inténtalo en unos minutos.`);
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 3_000_000) {
        controller.abort();
        clearTimeout(timer);
        fail("CALENDAR_TOO_LARGE", "El calendario es demasiado grande (más de 3 MB).");
      }
      chunks.push(value);
    }
    clearTimeout(timer);
    const text = Buffer.concat(chunks).toString("utf8");
    if (!text.includes("BEGIN:VCALENDAR")) {
      if (/<html|<!doctype/i.test(text.slice(0, 500)))
        fail(
          "NOT_A_CALENDAR",
          "Ese enlace abre una página web, no un calendario. Usa el enlace de «Exportar calendario» (suele terminar en .ics).",
        );
      fail("NOT_A_CALENDAR", "El enlace no devolvió un calendario iCal.");
    }
    return text;
  }
  fail("CALENDAR_UNREACHABLE", "El calendario redirige demasiadas veces.");
}

const dateOf = (value: string) => {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
const nextDay = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Tolerant iCal reader for OTA feeds: all-day and timed events, missing DTEND,
 * folded lines. CALA's own events (echoes) are skipped; recurrences rejected.
 */
export function parseOtaCalendar(text: string): OtaCalendarEvent[] {
  const events: OtaCalendarEvent[] = [];
  let fields: Map<string, string> | null = null;
  for (const line of text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/)) {
    if (line === "BEGIN:VEVENT") {
      fields = new Map();
      continue;
    }
    if (line === "END:VEVENT" && fields) {
      const f = fields;
      fields = null;
      const prop = (name: string) => {
        for (const [k, v] of f) if (k === name || k.startsWith(name + ";")) return v;
        return "";
      };
      const uid = prop("UID").trim();
      if (uid.endsWith("@cala.local") || prop("X-CALA-ORIGIN") === "CALA") continue;
      if (prop("RRULE"))
        fail("UNSUPPORTED_CALENDAR", "El calendario usa eventos repetitivos; las OTAs no los usan para reservas. Revisa que sea el enlace correcto.");
      const arrival = dateOf(prop("DTSTART"));
      if (!arrival) continue;
      let departure = dateOf(prop("DTEND")) ?? nextDay(arrival);
      if (departure <= arrival) departure = nextDay(arrival);
      const summary = prop("SUMMARY").replace(/\\,/g, ",").slice(0, 120);
      events.push({
        uid: (uid || `${arrival}:${departure}`).slice(0, 300),
        arrival,
        departure,
        cancelled: prop("STATUS").toUpperCase() === "CANCELLED",
        summary,
        kind: eventKind(uid, summary, prop("DESCRIPTION")),
      });
      if (events.length > 3000)
        fail("CALENDAR_TOO_LARGE", "El calendario tiene más de 3000 eventos.");
    } else if (fields) {
      const i = line.indexOf(":");
      if (i > 0) fields.set(line.slice(0, i).toUpperCase(), line.slice(i + 1));
    }
  }
  if (!text.includes("END:VCALENDAR"))
    fail("NOT_A_CALENDAR", "El calendario llegó incompleto. Inténtalo de nuevo.");
  return events;
}

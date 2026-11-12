import { test, expect } from "vitest";
import { parseOtaCalendar, providerForUrl } from "@/lib/cala/connectors/ical-feed";
import { matchReservation, parseInbound } from "@/lib/cala/connectors/mail-parse";
import { providerForSource } from "@/cala/domain/messaging/ota";

const airbnbFeed = [
  "BEGIN:VCALENDAR",
  "PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20270105",
  "DTSTART;VALUE=DATE:20270102",
  "UID:1418fb94e984-9b2a@airbnb.com",
  "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/de",
  " tails/HMABC12345",
  "SUMMARY:Reserved",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20270110T150000Z",
  "UID:timed@booking",
  "SUMMARY:CLOSED - Not available",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20270201",
  "DTEND;VALUE=DATE:20270203",
  "UID:abc@cala.local",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test("OTA calendar reader accepts all-day and timed events and skips CALA echoes", () => {
  expect(parseOtaCalendar(airbnbFeed)).toEqual([
    { uid: "1418fb94e984-9b2a@airbnb.com", arrival: "2027-01-02", departure: "2027-01-05", cancelled: false, summary: "Reserved" },
    { uid: "timed@booking", arrival: "2027-01-10", departure: "2027-01-11", cancelled: false, summary: "CLOSED - Not available" },
  ]);
  expect(() => parseOtaCalendar("BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20270101\nRRULE:FREQ=WEEKLY\nEND:VEVENT\nEND:VCALENDAR")).toThrow();
  expect(() => parseOtaCalendar("BEGIN:VCALENDAR\nBEGIN:VEVENT")).toThrow();
});

test("calendar URLs are attributed to their OTA", () => {
  expect(providerForUrl("https://www.airbnb.mx/calendar/ical/123.ics?s=1")).toBe("airbnb");
  expect(providerForUrl("https://ical.booking.com/v1/export?t=abc")).toBe("booking");
  expect(providerForUrl("https://www.vrbo.com/icalendar/x.ics")).toBe("vrbo");
  expect(providerForUrl("https://calendar.google.com/x.ics")).toBeNull();
});

test("an auto-forwarded Airbnb message keeps the relay reply address and the guest", () => {
  const parsed = parseInbound({
    from: "Ana via Airbnb <express@airbnb.com>",
    replyTo: ["4f1c2a9b@reply.airbnb.com"],
    subject: "RE: Reserva en Casa Caballo para 2–5 ene 2027",
    text: "Hola, ¿a qué hora podemos llegar?\n\nResponder\nhttps://www.airbnb.com/messaging/1\nAirbnb, Inc. 888 Brannan St",
    html: null,
  });
  expect(parsed).toMatchObject({
    kind: "message",
    provider: "airbnb",
    replyTo: "4f1c2a9b@reply.airbnb.com",
    guestName: "Ana",
    body: "Hola, ¿a qué hora podemos llegar?",
  });
});

test("Gmail forwarding confirmations, bounces and unrelated mail are classified", () => {
  const forwarding = parseInbound({
    from: "Gmail Team <forwarding-noreply@google.com>",
    replyTo: null,
    subject: "(#123456789) Gmail Forwarding Confirmation - Receive Mail from host@gmail.com",
    text: "Confirmation code: 123456789\nTo allow host@gmail.com to automatically forward mail to your address, please click the link below:\nhttps://mail-settings.google.com/mail/vf-%5BANGjdJ-abc%5D-xyz",
    html: null,
  });
  expect(forwarding.kind).toBe("forwarding");
  expect(JSON.parse(forwarding.summary)).toEqual({ code: "123456789", link: "https://mail-settings.google.com/mail/vf-%5BANGjdJ-abc%5D-xyz" });
  expect(parseInbound({ from: "MAILER-DAEMON@amazonses.com", replyTo: null, subject: "Undeliverable", text: "x@reply.airbnb.com rejected", html: null })).toMatchObject({ kind: "bounce", replyTo: "x@reply.airbnb.com" });
  expect(parseInbound({ from: "Tienda <ofertas@tienda.com>", replyTo: null, subject: "Promo", text: "hola", html: null }).kind).toBe("other");
});

test("a hand-forwarded Booking.com message is still recognised and matched", () => {
  const parsed = parseInbound({
    from: "Host <host@gmail.com>",
    replyTo: null,
    subject: "Fwd: Mensaje de Luis García sobre su reserva",
    text: "---------- Forwarded message ---------\nFrom: Luis García via Booking.com <987654@mchat.booking.com>\nDate: Mon\nSubject: Mensaje\n\n¿Tienen estacionamiento?\nNúmero de reserva: 4123456789",
    html: null,
  });
  expect(parsed).toMatchObject({ kind: "message", provider: "booking", replyTo: "987654@mchat.booking.com", externalCode: "4123456789" });
  expect(parsed.body).toBe("¿Tienen estacionamiento?\nNúmero de reserva: 4123456789");
  const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const reservations = [
    { id: "r1", code: "SMO-1", source: "booking", guest: "Luis Garcia", arrival: future, departure: future },
    { id: "r2", code: "SMO-2", source: "airbnb", guest: "Luis Pérez", arrival: future, departure: future },
  ];
  expect(matchReservation({ ...parsed, externalCode: null, guestName: "Luis García" }, reservations, providerForSource)).toBe("r1");
});

import type { CalendarProvider } from "./ical-feed";

export type MailKind = "message" | "forwarding" | "bounce" | "other";
export interface ParsedMail {
  kind: MailKind;
  provider: CalendarProvider | null;
  replyTo: string | null;
  guestName: string | null;
  externalCode: string | null;
  subject: string;
  body: string;
  summary: string;
}
export interface IncomingMail {
  from: string;
  subject: string;
  text: string | null;
  html: string | null;
  replyTo: string[] | null;
  headers?: Record<string, string> | null;
}

const providerDomains: [RegExp, CalendarProvider][] = [
  [/@([a-z0-9-]+\.)*airbnb\.[a-z.]+\b/i, "airbnb"],
  [/@([a-z0-9-]+\.)*booking\.com\b/i, "booking"],
  [/@([a-z0-9-]+\.)*(vrbo|homeaway)\.com\b/i, "vrbo"],
  [/@([a-z0-9-]+\.)*(expedia|expediapartnercentral|hotels)\.com\b/i, "expedia"],
];
/** Relay addresses that deliver a reply into the OTA conversation. */
const relayDomains =
  /@((reply|[a-z0-9-]+\.reply)\.airbnb\.com|(mchat|guest|property)\.booking\.com|messages\.(homeaway|vrbo)\.com|[a-z0-9-]*\.?expediapartnercentral\.com|m\.expediamail\.com)$/i;

export function htmlToText(html: string) {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const address = (value: string) =>
  (/<([^>]+)>/.exec(value)?.[1] ?? value).trim().toLowerCase();
const displayName = (value: string) =>
  (/^\s*"?([^"<]+?)"?\s*</.exec(value)?.[1] ?? "").trim();

function detectProvider(text: string): CalendarProvider | null {
  return providerDomains.find(([re]) => re.test(text))?.[1] ?? null;
}

function guestFrom(fromName: string, subject: string): string | null {
  const via = /^(.+?)\s*(?:\(|-)?\s*(?:via|vía|through|a través de)\s+(airbnb|booking\.com|vrbo|expedia)\)?$/i.exec(fromName);
  if (via) return via[1].trim();
  const patterns = [
    /(?:message|mensaje|consulta|inquiry|pregunta) (?:from|de) ([^,:|–-]+?)(?:\s+(?:about|sobre|para|for)\b|[,:|–-]|$)/i,
    /^(?:re:\s*)?([^,:|]+?) (?:sent you a message|te envió un mensaje|te ha enviado un mensaje|has sent you a message)/i,
    /(?:reservation|reserva|booking) (?:for|de|con) ([^,:|–-]+?)(?:\s+(?:at|en)\b|[,:|–-]|$)/i,
  ];
  for (const re of patterns) {
    const m = re.exec(subject);
    if (m && m[1].length <= 60 && !/airbnb|booking|vrbo|expedia/i.test(m[1])) return m[1].trim();
  }
  if (fromName && !/airbnb|booking|vrbo|expedia|homeaway|noreply|no-reply/i.test(fromName)) return fromName;
  return null;
}

function codeFrom(provider: CalendarProvider | null, text: string): string | null {
  if (provider === "airbnb") return /\bHM[A-Z0-9]{8}\b/.exec(text)?.[0] ?? null;
  if (provider === "booking")
    return /(?:reserva|booking|confirmation|confirmación|reservation)[^\d\n]{0,40}(\d{9,11})\b/i.exec(text)?.[1] ?? null;
  if (provider === "vrbo") return /\bHA-[A-Z0-9]{6,8}\b/.exec(text)?.[0] ?? null;
  if (provider === "expedia") return /(?:itinerary|itinerario|reservation id)[^\d\n]{0,30}(\d{8,14})\b/i.exec(text)?.[1] ?? null;
  return null;
}

/** Keeps the guest's words: drops quoted history, signatures and OTA footers. */
export function cleanMessage(text: string) {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^(on|el) .{6,120}(wrote|escribió):$/i.test(line)) break;
    if (/^-{2,}\s*(original message|mensaje original|forwarded message|mensaje reenviado)/i.test(line)) {
      out.length = 0; // forwarded by hand: the OTA e-mail starts below
      continue;
    }
    if (/^(de|from|para|to|asunto|subject|fecha|date|sent|enviado):\s/i.test(line) && out.length < 8) continue;
    if (line.startsWith(">")) continue;
    if (/^(reply|responder|respond|ver mensaje|view message|send a message)\b/i.test(line)) continue;
    if (/(airbnb, inc|airbnb ireland|booking\.com b\.v|unsubscribe|darte de baja|privacy policy|política de privacidad|this email was sent|este correo|get the app|descarga la app)/i.test(line))
      break;
    if (/^https?:\/\/\S+$/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 8000);
}

/** Classifies an e-mail that reached a CALA relay address. */
export function parseInbound(mail: IncomingMail): ParsedMail {
  const text = (mail.text?.trim() || (mail.html ? htmlToText(mail.html) : "")).slice(0, 200000);
  const from = mail.from ?? "";
  const fromAddress = address(from);
  const subject = (mail.subject ?? "").trim().slice(0, 300);
  const base = { subject, replyTo: null, guestName: null, externalCode: null, body: "", provider: null };

  if (/forwarding-noreply@google\.com/i.test(fromAddress) || /(forwarding confirmation|confirmación de reenvío|confirmar el reenvío)/i.test(subject)) {
    const code = /(?:confirmation code|código de confirmación)\D{0,12}(\d{6,12})/i.exec(text)?.[1] ?? /\b(\d{9})\b/.exec(text)?.[1] ?? "";
    const link = /(https:\/\/(?:mail-settings\.google\.com|mail\.google\.com)\/\S+)/.exec(text)?.[1] ?? "";
    return { ...base, kind: "forwarding", summary: JSON.stringify({ code, link }) };
  }
  if (/^(mailer-daemon|postmaster)@/i.test(fromAddress) || /(undeliverable|delivery status notification|could not be delivered|no se pudo entregar|returned mail|mensaje no entregado|couldn.t deliver|no pudimos entregar)/i.test(subject)) {
    const relay = /[a-z0-9._%+-]+@(reply\.airbnb\.com|mchat\.booking\.com|guest\.booking\.com|messages\.(homeaway|vrbo)\.com)/i.exec(text)?.[0] ?? null;
    return { ...base, kind: "bounce", replyTo: relay?.toLowerCase() ?? null, summary: cleanMessage(text).slice(0, 400) || subject };
  }

  // Auto-forwarding keeps the OTA as sender; manual forwarding puts it in the body.
  const provider = detectProvider(fromAddress) ?? detectProvider(text.slice(0, 4000));
  if (!provider) return { ...base, kind: "other", summary: subject || cleanMessage(text).slice(0, 200) };
  const replies = [...(mail.replyTo ?? []), from, ...(text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [])]
    .map(address)
    .filter((a) => relayDomains.test(a));
  const fromName = displayName(from);
  const body = cleanMessage(text);
  return {
    kind: "message",
    provider,
    replyTo: replies[0] ?? null,
    guestName: guestFrom(fromName, subject),
    externalCode: codeFrom(provider, `${subject}\n${text}`),
    subject,
    body: body || subject || "(Mensaje sin texto)",
    summary: (body || subject).slice(0, 200),
  };
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").trim();

/** Links a message to one CALA reservation when the match is unambiguous. */
export function matchReservation(
  parsed: ParsedMail,
  reservations: { id: string; code: string; source: string; guest: string; arrival: string; departure: string }[],
  sourceProvider: (source: string) => string | null,
) {
  if (parsed.externalCode) {
    const byCode = reservations.filter((r) => r.code.toUpperCase().includes(parsed.externalCode!.toUpperCase()));
    if (byCode.length === 1) return byCode[0].id;
  }
  if (!parsed.guestName) return null;
  const first = norm(parsed.guestName).split(" ")[0];
  if (!first || first.length < 2) return null;
  const today = new Date().toISOString().slice(0, 10);
  const candidates = reservations.filter(
    (r) =>
      sourceProvider(r.source) === parsed.provider &&
      r.departure >= today &&
      norm(r.guest).split(" ").includes(first),
  );
  return candidates.length === 1 ? candidates[0].id : null;
}

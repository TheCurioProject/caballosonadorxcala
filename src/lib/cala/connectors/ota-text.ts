/**
 * Reads the guest's own words out of an OTA notification e-mail. Shared by the
 * inbound webhook and the inbox screen (which also tidies messages stored
 * before this existed), so it must stay free of server-only imports.
 *
 * An Airbnb notice looks like:
 *   %opentrack%
 *   INQUIRY FOR <listing>, DEC 16–18
 *   For your protection and safety, always communicate through Airbnb [https://…].
 *   ERICK
 *   Booker
 *   Hello test v2
 *   Review inquiry [https://…/hosting/thread/123?…]
 *   …listing details, footer…
 */

const trackingTokens = /%[a-z_]+%/gi;
/** "Text [https://…]" links of the plain-text version (they may wrap lines). */
const bracketLinks = /\s*\[\s*https?:\/\/[^\]]*\]/gi;
const bareLink = /^<?https?:\/\/\S+>?[.,]?$/i;

const safetyLine =
  /(for your (protection|safety)|always communicate through (airbnb|the app)|por tu (protecci[oó]n|seguridad)|comun[ií]cate siempre (a trav[eé]s de|por) airbnb|pour votre (protection|s[ée]curit[ée]))/i;
const roleLine =
  /^(booker|guest|co-?travell?er|travell?er|host|co-?host|hu[eé]sped|viajer[oa]|reservante|(persona )?que reserv[oó]|quien reserv[oó]|anfitri[oó]n|coanfitri[oó]n|voyageur|h[oô]te)$/i;
const actionLine =
  /^(reply|respond|review (the )?(inquiry|request|reservation|booking)|pre-?approve|decline|accept|view (the )?(message|messages|inquiry|request|reservation|booking|trip)|send (a )?message|go to (your )?(inbox|messages)|responder|revisar (la )?(consulta|solicitud|reserva(ci[oó]n)?)|ver (el |la )?(mensaje|mensajes|consulta|solicitud|reserva(ci[oó]n)?)|preaprobar|rechazar|aceptar|enviar (un )?mensaje)\b/i;
const footerLine =
  /(airbnb, inc|airbnb ireland|888 brannan|booking\.com b\.v|unsubscribe|darte de baja|privacy policy|pol[ií]tica de privacidad|this email was sent|este correo (electr[oó]nico )?(fue|se) envi|get the app|descarga la app|help cent(er|re)|centro de ayuda)/i;

/** Plain-text lines without tracking tokens, bracketed links or bare URLs. */
export function tidyLines(text: string): string[] {
  return text
    .replace(trackingTokens, "")
    .replace(bracketLinks, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !bareLink.test(l));
}

const looksLikeName = (line: string) => line.length >= 2 && line.length <= 60 && /^\p{L}[\p{L}\p{M}'’. -]*$/u.test(line);

/** "ERICK" → "Erick", "maría josé" → "María José"; mixed case is kept. */
export function properName(raw: string) {
  const s = raw.trim().replace(/\s+/g, " ");
  if (s !== s.toLocaleUpperCase() && s !== s.toLocaleLowerCase()) return s;
  return s.toLocaleLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase());
}

/** The guest's name and words, or null when the e-mail is not a guest message. */
export function otaGuestMessage(text: string): { guestName: string; message: string } | null {
  const lines = tidyLines(text);
  let start = -1;
  let name = "";
  // «NAME» followed by a role line («Booker», «Guest», «Huésped»…) opens a message.
  for (let i = 1; i < lines.length && start < 0; i++) {
    if (!roleLine.test(lines[i])) continue;
    let j = i - 1;
    while (j >= 0 && !lines[j]) j--;
    if (j >= 0 && looksLikeName(lines[j])) {
      name = lines[j];
      start = i + 1;
    }
  }
  // Older layout: the name comes right after the safety line.
  if (start < 0) {
    const s = lines.findIndex((l) => safetyLine.test(l));
    if (s < 0) return null;
    let j = s + 1;
    while (j < lines.length && (!lines[j] || /^[.,]$/.test(lines[j]))) j++;
    if (j >= lines.length || !looksLikeName(lines[j])) return null;
    name = lines[j];
    start = j + 1;
  }
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (actionLine.test(line) || footerLine.test(line) || safetyLine.test(line)) break;
    if (roleLine.test(line)) {
      // A second «NAME / role» header in the same e-mail: keep only the words.
      while (out.length && !out[out.length - 1]) out.pop();
      if (out.length && looksLikeName(out[out.length - 1])) out.pop();
      continue;
    }
    out.push(line);
  }
  const message = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return message ? { guestName: properName(name), message } : null;
}

/** A raw OTA template (tracking token) that holds no guest words: a security or marketing notice. */
export function isOtaNotice(text: string) {
  return /%opentrack%/i.test(text) && !otaGuestMessage(text);
}

/** Generic thread names CALA stores when the guest was not recognised. */
export const unnamedGuest = /^(hu[eé]sped|guest)$/i;

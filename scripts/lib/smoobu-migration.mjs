import { createHash, createHmac, randomUUID } from 'node:crypto';

export const EXPECTED_ACCOUNT_ID = 1939851;
export const WIDGET_APARTMENT_IDS = [3577956, 3577971, 3577976, 3577981, 3577986, 3577991, 3577996];
export const API_ORIGIN = 'https://login.smoobu.com';

export function normalizeDatabaseUrl(value) {
  if (!value) throw new Error('Falta DATABASE_URL.');
  const clean = value.replace(/@https?:\/\//, '@').replace(/@www\./, '@')
    .replace(/\/:(\d+)/, ':$1').replace(/^mariadb:\/\//, 'mysql://');
  const url = new URL(clean);
  url.searchParams.delete('connectionLimit');
  url.searchParams.set('connection_limit', '1');
  url.searchParams.set('connect_timeout', '15');
  return url.href;
}

export function dateOnly(value) {
  const date = new Date(value);
  if (value == null || !Number.isFinite(date.getTime())) throw new Error('Fecha inválida.');
  return date.toISOString().slice(0, 10);
}

export const normalize = (value) => String(value || '').normalize('NFKD')
  .replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const markerFor = (booking) => `[hotelsonador:booking:${booking.propertyId}:${booking.id}]`;
export const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const overlaps = (a, b) => a.arrival < b.departure && a.departure > b.arrival;

function amount(value, label) {
  const number = Number(value);
  if (value == null || !Number.isFinite(number) || number < 0) throw new Error(`${label} inválido.`);
  return Math.round(number * 100) / 100;
}

export function buildEntry(booking, { apartmentId, override = {} } = {}) {
  const entry = {
    bookingId: booking.id, propertyId: booking.propertyId,
    marker: markerFor(booking), fingerprint: fingerprint(booking),
    state: 'ready', reasons: [], warnings: [],
  };
  if (booking.payment_status !== 'CONFIRMED' || !['WEBSITE', 'MANUAL'].includes(booking.origin)) {
    return { ...entry, state: 'skipped', reasons: ['No es una reserva propia confirmada.'] };
  }
  try {
    if (!override || typeof override !== 'object' || Array.isArray(override)) throw new Error('La corrección debe ser un objeto.');
    const allowedOverrides = ['adults', 'children', 'paid', 'prepaymentMxn', 'guestName', 'guestEmail', 'guestPhone'];
    if (Object.keys(override).some(key => !allowedOverrides.includes(key))) throw new Error('Corrección desconocida.');
    const arrival = dateOnly(booking.checkIn);
    const departure = dateOnly(booking.checkOut);
    if (arrival >= departure) throw new Error('La salida debe ser posterior a la llegada.');
    const guestName = String(override.guestName ?? booking.guestName ?? '').trim();
    if (!guestName) throw new Error('Falta el nombre del huésped.');
    const [firstName, ...rest] = guestName.split(/\s+/);
    const price = amount(booking.totalPrice, 'Importe');
    const paid = amount(booking.depositPaid ?? 0, 'Anticipo');
    const currency = String(booking.depositCurrency || 'MXN').toUpperCase();
    const notices = [entry.marker, `Reserva original #${booking.id}; alojamiento local #${booking.propertyId}.`,
      `Nombre original: ${guestName}.`, `Estado original: ${booking.payment_status}; origen: ${booking.origin}.`,
      `Importe original: ${price} MXN. Anticipo registrado: ${paid} ${currency}.`];
    const payload = { arrivalDate: arrival, departureDate: departure, firstName, price,
      language: ['en', 'es'].includes(booking.invoiceLanguage) ? booking.invoiceLanguage : 'es' };
    if (apartmentId != null) payload.apartmentId = apartmentId;
    if (rest.length) payload.lastName = rest.join(' ');
    else entry.warnings.push('Apellido no registrado; puede ser requerido por Smoobu.');

    const email = String(override.guestEmail ?? booking.guestEmail ?? '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && normalize(email) !== 'manual@reserva.com') {
      payload.email = email;
    } else {
      entry.warnings.push('No hay correo real válido; se omite el correo de relleno.');
      notices.push('Correo no registrado o de relleno en el sistema original.');
    }
    const phone = String(override.guestPhone ?? booking.guestPhone ?? '').trim();
    if (phone) payload.phone = phone;
    else entry.warnings.push('Teléfono no registrado; puede ser requerido por Smoobu.');

    if (override.adults != null) {
      const children = override.children ?? 0;
      if (!Number.isInteger(override.adults) || override.adults < 1 || !Number.isInteger(children)
          || children < 0 || override.adults + children > 12) throw new Error('La ocupación debe ser de 1 a 12 huéspedes.');
      payload.adults = override.adults;
      payload.children = children;
    } else {
      if (override.children != null) throw new Error('Indica adultos junto con niños.');
      entry.warnings.push('Número de huéspedes desconocido; no se inventa una ocupación.');
      notices.push('Número real de huéspedes no registrado en origen: POR CONFIRMAR. Cualquier valor por defecto de Smoobu debe revisarse.');
    }

    if (paid > 0 && currency !== 'MXN' && override.prepaymentMxn == null) {
      throw new Error('El anticipo está en otra moneda; falta el importe confirmado en MXN.');
    }
    const prepayment = override.prepaymentMxn != null ? amount(override.prepaymentMxn, 'Anticipo MXN') : paid;
    if (prepayment > price) throw new Error('El anticipo supera el importe de la reserva.');
    if (prepayment > 0) {
      payload.prepayment = prepayment;
      payload.prepaymentStatus = 1;
    }
    if (override.paid != null) {
      if (typeof override.paid !== 'boolean') throw new Error('paid debe ser true o false.');
      payload.priceStatus = override.paid ? 1 : 0;
    } else if (price > 0 && prepayment === price) {
      payload.priceStatus = 1;
    } else {
      entry.warnings.push('Pago total no acreditado; CONFIRMED no se interpreta como pago completo.');
      notices.push('El estado CONFIRMED acredita la reserva, no el pago total. Revisar el saldo con los comprobantes originales.');
    }
    if (booking.notes) notices.push(`Notas originales: ${booking.notes}`);
    if (booking.addons?.length) notices.push(`Servicios del sistema original (incluidos en el importe; no cobrar otra vez): ${JSON.stringify(booking.addons)}`);
    payload.notice = notices.join('\n');
    entry.payload = payload;
    entry.arrival = arrival;
    entry.departure = departure;
  } catch (error) {
    entry.state = 'review';
    entry.reasons.push(error.message);
  }
  return entry;
}

export function remoteDecision(entry, bookings, apartmentId) {
  if (entry.state !== 'ready') return entry;
  const active = bookings.filter(b => b.type !== 'cancellation');
  const marked = active.filter(b => String(b.notice || '').includes(entry.marker));
  if (marked.length) {
    const match = marked[0];
    if (marked.length !== 1 || Number(match.apartment?.id) !== apartmentId || !Number.isFinite(Number(match.price))
        || match.arrival !== entry.arrival || match.departure !== entry.departure
        || Math.abs(Number(match.price) - entry.payload.price) > 0.01) {
      return { ...entry, state: 'review', reasons: ['La reserva ya migrada difiere del origen o está duplicada.'] };
    }
    return { ...entry, state: 'existing', remoteId: match.id, reasons: ['Ya migrada; no se vuelve a crear.'] };
  }
  const relevant = active.filter(b => Number(b.apartment?.id) === apartmentId
    || b.related?.some(a => Number(a.id) === apartmentId));
  const sameGuest = b => (entry.payload.email && normalize(b.email) === normalize(entry.payload.email))
    || normalize(b['guest-name'] || [b.firstname, b.lastname].filter(Boolean).join(' '))
      === normalize([entry.payload.firstName, entry.payload.lastName].filter(Boolean).join(' '));
  const equivalent = relevant.filter(b => Number(b.apartment?.id) === apartmentId && !b['is-blocked-booking']
    && b.arrival === entry.arrival && b.departure === entry.departure && sameGuest(b));
  if (equivalent.length === 1 && Number.isFinite(Number(equivalent[0].price))
      && Math.abs(Number(equivalent[0].price) - entry.payload.price) <= 0.01) {
    return { ...entry, state: 'existing', remoteId: equivalent[0].id, reasons: ['Mismo huésped, fechas e importe en Smoobu.'] };
  }
  const conflicts = relevant.filter(b => overlaps(entry, b));
  if (conflicts.length) return { ...entry, state: 'review', reasons: [`Se superpone con Smoobu: ${conflicts.map(b => b.id).join(', ')}.`] };
  return entry;
}

export function markLocalOverlaps(entries) {
  const candidates = entries.filter(e => ['ready', 'review', 'existing'].includes(e.state) && e.arrival && e.departure);
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i], b = candidates[j];
      if (a.propertyId === b.propertyId && overlaps(a, b)) {
        for (const [entry, other] of [[a, b], [b, a]]) {
          entry.state = 'review';
          entry.reasons.push(`Se superpone con la reserva local #${other.bookingId}.`);
        }
      }
    }
  }
  return entries;
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const displayDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? value.split('-').reverse().join('/') : String(value || '—');

export function renderConflictReport(report, remoteBookings) {
  const reviewed = report.entries.filter(entry => entry.state === 'review');
  const cards = reviewed.map(entry => {
    const conflicts = remoteBookings.filter(b => b.type !== 'cancellation'
      && (Number(b.apartment?.id) === report.target?.id || b.related?.some(a => Number(a.id) === report.target?.id))
      && overlaps(entry, b));
    const name = [entry.payload?.firstName, entry.payload?.lastName].filter(Boolean).join(' ');
    const rows = conflicts.map(b => `<tr><td>#${escapeHtml(b.id)}</td><td>${escapeHtml(b.apartment?.name)}</td><td>${escapeHtml(b['guest-name'] || [b.firstname, b.lastname].filter(Boolean).join(' '))}</td><td>${escapeHtml(displayDate(b.arrival))} – ${escapeHtml(displayDate(b.departure))}</td><td>${b['is-blocked-booking'] ? 'Bloqueo' : 'Reserva'}<br><small>${escapeHtml(b.channel?.name)}</small></td></tr>`).join('');
    return `<article><h2>Reserva local #${escapeHtml(entry.bookingId)} · ${escapeHtml(name)}</h2><p class="dates">${escapeHtml(displayDate(entry.arrival))} – ${escapeHtml(displayDate(entry.departure))} · Casa completa</p><p>${entry.reasons.map(escapeHtml).join('<br>')}</p>${rows ? `<div class="table-wrap"><table><thead><tr><th>ID en Smoobu</th><th>Alojamiento</th><th>Huésped registrado</th><th>Fechas en Smoobu</th><th>Tipo</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}<p class="hint">Revisar si son las mismas estancias registradas de otra manera o reservas distintas. No se deben borrar reservas existentes ni crear una sobreventa para resolver una coincidencia.</p></article>`;
  }).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Revisión de migración a Smoobu</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f9f7f4;color:#23211f;font:15px/1.6 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:32px 20px}h1,h2{font-family:Georgia,serif;font-weight:400}h1{font-size:32px;margin:8px 0}h2{font-size:23px}.brand{color:#9b7e67;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase}.summary{background:#23211f;color:white;padding:20px 24px;border-radius:18px;margin:24px 0}article{background:white;border:1px solid #e7e2dc;border-radius:18px;padding:24px;margin:20px 0}.dates{color:#9b7e67;font-weight:600}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #eee}th{background:#f9f7f4}small,.hint{color:#666}.hint{font-size:13px;margin-bottom:0}a{color:#9b7e67}@media print{body{background:white}main{padding:0}article{break-inside:avoid}th{background:#eee}.summary{color:black;background:#eee}}
  </style></head><body><main><div class="brand">Casa Caballo Soñador · Informe privado</div><h1>Revisión de reservas existentes</h1><p>Destino: ${escapeHtml(report.target?.name || 'Por configurar')} · ID ${escapeHtml(report.target?.id || '—')}</p><div class="summary"><strong>${reviewed.length} reservas necesitan revisión</strong><br>Este informe compara datos; no aplica cambios por sí mismo. Conserva este archivo de forma privada porque contiene nombres de huéspedes.</div>${cards || '<article>No hay conflictos detectados en esta revisión.</article>'}<p class="hint">Cada coincidencia debe resolverse conservando las fechas y el alojamiento reales de cada reserva. El detalle técnico está en plan.json.</p></main></body></html>`;
}

const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
export function canonicalQuery(searchParams) {
  return [...searchParams].map(([k, v]) => [encode(k), encode(v)])
    .sort(([ak, av], [bk, bv]) => ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0)
    .map(pair => pair.join('=')).join('&');
}

export function signRequest({ key, secret, method, url, body = '', timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), nonce = randomUUID() }) {
  const canonical = [method.toUpperCase(), url.pathname, canonicalQuery(url.searchParams), timestamp, nonce,
    createHash('sha256').update(body).digest('hex'), key].join('\n');
  return { 'X-API-Key': key, 'X-Timestamp': timestamp, 'X-Nonce': nonce,
    'X-Signature': createHmac('sha256', secret).update(canonical).digest('base64') };
}

export class SmoobuError extends Error {
  constructor(status, details) {
    super(`Smoobu devolvió HTTP ${status}. Consulta el informe privado.`);
    this.status = status;
    this.details = details;
  }
}

export class SmoobuClient {
  constructor({ key, secret, fetchImpl = fetch }) {
    if (!key || !secret) throw new Error('Faltan SMOOBU_API_KEY y SMOOBU_API_SECRET en .env.local.');
    this.key = key;
    this.secret = secret;
    this.fetchImpl = fetchImpl;
  }
  async request(path, { method = 'GET', data } = {}) {
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/api/')) throw new Error('Destino API no permitido.');
    const body = data === undefined ? '' : JSON.stringify(data);
    const response = await this.fetchImpl(url, { method, redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(30000),
      headers: { ...signRequest({ key: this.key, secret: this.secret, method, url, body }),
        Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body } : {}) });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new SmoobuError(response.status, result);
    if (!result || typeof result !== 'object') throw new Error('Respuesta JSON de Smoobu inválida.');
    return result;
  }
  async getBookings({ from, to, includePriceElements = false } = {}) {
    const bookings = new Map();
    let pages = 1, total;
    for (let page = 1; page <= pages; page++) {
      const query = new URLSearchParams({page: String(page), pageSize:'100', showCancellation:'true'});
      if (from) query.set('from', from);
      if (to) query.set('to', to);
      if (includePriceElements) query.set('includePriceElements', 'true');
      const data = await this.request('/api/reservations?' + query);
      const pageCount = Number(data.page_count), itemCount = Number(data.total_items);
      if (!Array.isArray(data.bookings) || !Number.isInteger(pageCount) || pageCount < 0 || pageCount > 10000
          || !Number.isInteger(itemCount) || itemCount < 0 || Number(data.page) !== page
          || (total != null && (itemCount !== total || pageCount !== pages))) throw new Error('La paginación de Smoobu cambió o es inválida; repite la revisión.');
      pages = pageCount;
      total = itemCount;
      for (const booking of data.bookings) {
        if (!Number.isInteger(booking.id) || bookings.has(booking.id)) throw new Error('Lista de Smoobu incompleta o duplicada.');
        if (dateOnly(booking.arrival) !== booking.arrival || dateOnly(booking.departure) !== booking.departure) throw new Error('Fechas remotas inválidas.');
        bookings.set(booking.id, booking);
      }
    }
    if (bookings.size !== total) throw new Error('Lista de Smoobu incompleta; no se puede comprobar duplicados.');
    return [...bookings.values()];
  }
}

export function ledgerDecision(entry, receipt) {
  if (receipt?.fingerprint && ['ready', 'existing'].includes(entry.state) && receipt.fingerprint !== entry.fingerprint) {
    return { ...entry, state: 'review', reasons: ['Los datos locales cambiaron desde el intento anterior.'] };
  }
  if (!receipt || entry.state === 'existing' || entry.state !== 'ready') return entry;
  if (receipt.status === 'failed') return entry;
  return { ...entry, state: 'review', reasons: ['Hay un intento previo sin reconciliar; no se repite el envío.'] };
}

export async function executeEntries(entries, { client, ledger, saveLedger, loadSource, onProgress = async () => {} }) {
  if (entries.some(entry => entry.state === 'review')) throw new Error('Hay reservas que necesitan revisión; no se ha importado ninguna.');
  for (const entry of entries.filter(entry => entry.state === 'ready')) {
    const source = await loadSource(entry.bookingId);
    if (!source || fingerprint(source) !== entry.fingerprint) throw new Error(`La reserva #${entry.bookingId} cambió; genera una revisión nueva.`);
    const current = ledgerDecision(remoteDecision(entry, await client.getBookings(), entry.payload.apartmentId), ledger[entry.marker]);
    if (current.state === 'existing') { await onProgress(current); continue; }
    if (current.state !== 'ready') throw new Error(`Conflicto al revisar la reserva #${entry.bookingId}; importación detenida.`);

    ledger[entry.marker] = { status: 'attempting', bookingId: entry.bookingId, apartmentId: entry.payload.apartmentId,
      fingerprint: entry.fingerprint, attemptedAt: new Date().toISOString() };
    // Persist intent before POST: an interrupted/ambiguous request must never be retried blindly.
    await saveLedger(ledger);
    let remoteId;
    try {
      const response = await client.request('/api/reservations', { method: 'POST', data: entry.payload });
      remoteId = response.id;
      if (!Number.isInteger(remoteId) || remoteId < 1) throw new Error('Smoobu no devolvió un identificador de reserva válido.');
      Object.assign(ledger[entry.marker], { status: 'unverified', remoteId });
      await saveLedger(ledger);
      const verified = await client.request(`/api/reservations/${remoteId}`);
      const result = remoteDecision(entry, [verified], entry.payload.apartmentId);
      if (result.state !== 'existing' || !String(verified.notice || '').includes(entry.marker)
          || (entry.payload.prepayment != null && (!Number.isFinite(Number(verified.prepayment))
            || Math.abs(Number(verified.prepayment) - entry.payload.prepayment) > 0.01))) {
        throw new Error('La reserva creada no coincide con los datos enviados.');
      }
      Object.assign(ledger[entry.marker], { status: 'verified', verifiedAt: new Date().toISOString() });
      await saveLedger(ledger);
      await onProgress({ ...result, state: 'imported' });
    } catch (error) {
      Object.assign(ledger[entry.marker], {
        status: remoteId ? 'unverified' : error instanceof SmoobuError && error.status >= 400 && error.status < 500 ? 'failed' : 'uncertain',
        error: error.message, ...(error.details ? { details: error.details } : {}),
      });
      await saveLedger(ledger);
      throw new Error(`Se detuvo la importación en la reserva #${entry.bookingId}. Revisa el registro privado antes de continuar.`);
    }
  }
}

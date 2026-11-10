import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { buildEntry, remoteDecision, markLocalOverlaps, ledgerDecision, signRequest,
  canonicalQuery, SmoobuClient, SmoobuError, executeEntries, renderConflictReport } from './lib/smoobu-migration.mjs';

const apartmentId = 3577956;
const booking = (changes = {}) => ({ id: 1, propertyId: 1, guestName: 'Ana López',
  guestEmail: 'ana@example.com', guestPhone: '+525555555555', checkIn: new Date('2026-12-01'),
  checkOut: new Date('2026-12-04'), origin: 'MANUAL', payment_status: 'CONFIRMED',
  totalPrice: 15000, depositPaid: 5000, depositCurrency: 'MXN', invoiceLanguage: 'es', addons: [], ...changes });
const entry = (changes, override) => buildEntry(booking(changes), { apartmentId, override });
const remote = (changes = {}) => ({ id: 99, apartment: { id: apartmentId }, type: 'reservation',
  arrival: '2026-12-01', departure: '2026-12-04', 'guest-name': 'Ana López',
  email: 'ana@example.com', price: 15000, prepayment: 5000, related: [], notice: '', ...changes });

test('payload preserves dates, contacts and real advance payment without inventing occupancy or full payment', () => {
  const result = entry();
  assert.equal(result.state, 'ready');
  assert.equal(result.payload.arrivalDate, '2026-12-01');
  assert.equal(result.payload.departureDate, '2026-12-04');
  assert.equal(result.payload.firstName, 'Ana');
  assert.equal(result.payload.lastName, 'López');
  assert.equal(result.payload.email, 'ana@example.com');
  assert.equal(result.payload.prepayment, 5000);
  assert.equal(result.payload.prepaymentStatus, 1);
  assert.equal('deposit' in result.payload, false, 'booking advance must not become a security deposit');
  assert.equal('adults' in result.payload, false);
  assert.equal('children' in result.payload, false);
  assert.equal('priceStatus' in result.payload, false);
  assert.match(result.payload.notice, /POR CONFIRMAR/);
  assert.match(result.payload.notice, /CONFIRMED acredita la reserva, no el pago/);
});

test('only own confirmed reservations are eligible', () => {
  for (const changes of [{ payment_status: 'PENDING' }, { payment_status: 'CANCELLED' }, { origin: 'AIRBNB' }, { origin: 'ICAL_SYNC' }]) {
    assert.equal(entry(changes).state, 'skipped');
  }
  assert.equal(entry({ origin: 'WEBSITE' }).state, 'ready');
});

test('rejects invalid dates, negative money, excessive advance payments, and unconfirmed exchange rates', () => {
  for (const changes of [{ checkOut: new Date('2026-11-30') }, { checkIn: 'invalid' },
    { totalPrice: -1 }, { totalPrice: Infinity }, { depositPaid: 15001 }, { depositCurrency: 'USD' }]) {
    assert.equal(entry(changes).state, 'review');
  }
  assert.equal(entry({ depositCurrency: 'USD' }, { prepaymentMxn: 9000 }).payload.prepayment, 9000);
});

test('requires explicit valid occupancy corrections and keeps the house limit at 12', () => {
  assert.equal(entry({}, { adults: 12, children: 0 }).payload.adults, 12);
  for (const override of [{ adults: 13 }, { adults: 0 }, { adults: 11, children: 2 }, { adults: 1.5 }, { children: 1 },
    { adults: 2, children: -1 }, { person: 2 }, { paid: 'yes' }, []]) {
    assert.equal(entry({}, override).state, 'review');
  }
  assert.equal(entry({}, { paid: true }).payload.priceStatus, 1);
  assert.equal(entry({ depositPaid: 15000 }).payload.priceStatus, 1);
  assert.equal(entry({ guestEmail: 'manual@reserva.com' }).payload.email, undefined);
});

test('detects migrated and manually entered duplicates without matching partial source IDs', () => {
  const local = entry();
  assert.equal(remoteDecision(local, [remote({ notice: local.marker })], apartmentId).state, 'existing');
  assert.equal(remoteDecision(local, [remote()], apartmentId).state, 'existing');
  assert.equal(remoteDecision(local, [remote({ notice: '[hotelsonador:booking:1:10]', email: 'other@example.com', 'guest-name': 'Other Guest' })], apartmentId).state, 'review');
  assert.equal(remoteDecision(local, [remote({ notice: local.marker, price: 'invalid' })], apartmentId).state, 'review');
  assert.equal(remoteDecision(local, [remote({ notice: local.marker }), remote({ id: 100, notice: local.marker })], apartmentId).state, 'review');
});

test('checks room-related blocks, ignores cancellations and unrelated properties, and allows same-day checkout/checkin', () => {
  const local = entry();
  assert.equal(remoteDecision(local, [remote({ 'is-blocked-booking': true })], apartmentId).state, 'review');
  assert.equal(remoteDecision(local, [remote({ apartment: { id: 5 }, related: [{ id: apartmentId }] })], apartmentId).state, 'review');
  assert.equal(remoteDecision(local, [remote({ type: 'cancellation' })], apartmentId).state, 'ready');
  assert.equal(remoteDecision(local, [remote({ apartment: { id: 5 } })], apartmentId).state, 'ready');
  assert.equal(remoteDecision(local, [remote({ arrival: '2026-12-04', departure: '2026-12-07' })], apartmentId).state, 'ready');
  assert.ok(markLocalOverlaps([entry(), entry({ id: 2 })]).every(e => e.state === 'review'));
});

test('HMAC signs exact UTF-8 JSON and RFC3986 sorted queries using the documented seven canonical fields', () => {
  const body = JSON.stringify({ notice: 'Habitación · huésped' });
  const url = new URL('https://login.smoobu.com/api/reservations?z=hello+world&a%5B%5D=%21');
  const timestamp = '2026-11-07T12:00:00Z', nonce = '550e8400-e29b-41d4-a716-446655440000';
  assert.equal(canonicalQuery(url.searchParams), 'a%5B%5D=%21&z=hello%20world');
  const expected = ['POST', '/api/reservations', 'a%5B%5D=%21&z=hello%20world', timestamp, nonce,
    createHash('sha256').update(body).digest('hex'), 'sample-key'].join('\n');
  const headers = signRequest({ key: 'sample-key', secret: 'sample-secret', method: 'POST', url, body, timestamp, nonce });
  assert.equal(headers['X-Signature'], createHmac('sha256', 'sample-secret').update(expected).digest('base64'));
  assert.equal(headers['X-API-Key'], 'sample-key');
  assert.equal(headers['X-Nonce'], nonce);
});

test('client never redirects credentials, paginates completely, and refuses incomplete snapshots', async () => {
  const requests = [];
  const client = new SmoobuClient({ key: 'sample-key', secret: 'sample-secret', fetchImpl: async (url, options) => {
    requests.push({ url, options });
    const page = Number(url.searchParams.get('page'));
    return { ok: true, json: async () => ({ page, page_count: 2, total_items: 2, bookings: [remote({ id: page })] }) };
  } });
  assert.equal((await client.getBookings()).length, 2);
  assert.equal(requests[0].options.redirect, 'error');
  assert.equal(requests[0].options.cache, 'no-store');
  assert.notEqual(requests[0].options.headers['X-Nonce'], requests[1].options.headers['X-Nonce']);
  await assert.rejects(client.request('https://example.com/api/reservations'), /no permitido/);
  const broken = new SmoobuClient({ key: 'key', secret: 'secret', fetchImpl: async () => ({ ok: true,
    json: async () => ({ page: 1, page_count: 1, total_items: 2, bookings: [remote()] }) }) });
  await assert.rejects(broken.getBookings(), /incompleta/);
});

function execution({ failPost, failVerify, source = booking() } = {}) {
  const local = entry();
  const ledger = {}, saved = [], calls = [], results = [];
  const client = { getBookings: async () => [], request: async (path, options) => {
    calls.push({ path, options });
    if (options?.method === 'POST') {
      assert.equal(saved[0][local.marker].status, 'attempting', 'intent must be durable before POST');
      if (failPost) throw failPost;
      return { id: 99 };
    }
    if (failVerify) throw new Error('Unavailable');
    return remote({ notice: local.marker });
  } };
  const options = { client, ledger, saveLedger: async value => { saved.push(structuredClone(value)); },
    loadSource: async () => source, onProgress: async result => { results.push(result); } };
  return { local, options, ledger, saved, calls, results };
}

test('import persists intent and receipt, verifies the created booking, and sends no payment or message request', async () => {
  const run = execution();
  await executeEntries([run.local], run.options);
  assert.equal(run.ledger[run.local.marker].status, 'verified');
  assert.equal(run.results[0].state, 'imported');
  assert.deepEqual(run.calls.map(call => call.path), ['/api/reservations', '/api/reservations/99']);
});

test('source changes and review entries prevent all remote writes', async () => {
  const changed = execution({ source: booking({ totalPrice: 25000 }) });
  await assert.rejects(executeEntries([changed.local], changed.options), /cambió/);
  assert.equal(changed.calls.length, 0);
  const review = execution();
  await assert.rejects(executeEntries([{ ...review.local, state: 'review' }], review.options), /revisión/);
  assert.equal(review.calls.length, 0);
});

test('ambiguous POST failure and failed verification cannot trigger a blind retry', async () => {
  for (const config of [{ failPost: new Error('Timeout') }, { failVerify: true }]) {
    const run = execution(config);
    await assert.rejects(executeEntries([run.local], run.options), /detuvo/);
    assert.equal(run.calls.filter(call => call.options?.method === 'POST').length, 1);
    assert.equal(ledgerDecision(run.local, run.ledger[run.local.marker]).state, 'review');
    const reconciled = remoteDecision(run.local, [remote({ notice: run.local.marker })], apartmentId);
    assert.equal(ledgerDecision(reconciled, run.ledger[run.local.marker]).state, 'existing');
  }
});

test('a definitive validation rejection is recorded without retrying and can be reviewed again', async () => {
  const run = execution({ failPost: new SmoobuError(400, { detail: 'Validation failed' }) });
  await assert.rejects(executeEntries([run.local], run.options), /detuvo/);
  assert.equal(run.ledger[run.local.marker].status, 'failed');
  assert.equal(ledgerDecision(run.local, run.ledger[run.local.marker]).state, 'ready');
});

test('a newly appearing remote conflict stops import before POST', async () => {
  const run = execution();
  run.options.client.getBookings = async () => [remote({ email: 'other@example.com', 'guest-name': 'Other Guest' })];
  await assert.rejects(executeEntries([run.local], run.options), /Conflicto/);
  assert.equal(run.calls.length, 0);
});

test('review report shows related-room conflicts and escapes guest-provided HTML', () => {
  const local = entry({ guestName: '<script>alert(1)</script> Guest' });
  local.state = 'review';
  const html = renderConflictReport({ target: { id: apartmentId, name: 'Casa completa' }, entries: [local] },
    [remote({ apartment: { id: 7, name: 'Room 7' }, related: [{ id: apartmentId }], 'guest-name': '<img src=x onerror=alert(1)>' })]);
  assert.match(html, /Room 7/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('<img'), false);
});

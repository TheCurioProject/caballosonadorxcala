const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Load the actual TypeScript modules with boundary mocks; no database, payment, or email traffic.
function load(relative, mocks = {}) {
  const filename = path.resolve(relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`, mocks);
    if(id.startsWith('.')){
      const resolved=path.resolve(path.dirname(filename),id);
      for(const suffix of ['.ts','.tsx'])if(fs.existsSync(resolved+suffix))return load(resolved+suffix,mocks);
    }
    return Module.createRequire(filename)(id);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX,
  } });
  mod._compile(compiled.outputText, filename);
  return mod.exports;
}
class NextResponse extends Response {
  static json(value, init) { return new NextResponse(JSON.stringify(value), { ...init, headers: { 'content-type': 'application/json', ...init?.headers } }); }
}
const policy = load('src/lib/bookingPolicy.ts');
const ranges = load('src/lib/dateRanges.ts');
const request = body => new Request('http://localhost:3000/api/checkout/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('calendar dates reject rollover, invalid types and timestamps', () => {
  for (const date of ['2027-02-29', '2026-04-31', '2026-13-01', 'bad', '2026-11-07T00:00:00Z', null, {}]) assert.equal(policy.parseCalendarDate(date), null);
  assert.equal(policy.parseCalendarDate('2028-02-29').toISOString(), '2028-02-29T00:00:00.000Z');
});

test('hotel day stays correct near UTC midnight', () => {
  assert.equal(policy.hotelToday(new Date('2026-11-08T02:00:00Z')), '2026-11-07');
});

test('addon prices and names come from active catalog, never the request', () => {
  const food = [{ id: 2, name: 'Dinner', price: 125.5, isActive: true }];
  const item = policy.verifyAddon({ type: 'FOOD_2_2026-12-01', quantity: 3, price: -999, unitPrice: 0, name: 'Forged' }, food, []);
  assert.equal(item.price, 376.5);
  assert.equal(item.unitPrice, 125.5);
  assert.equal(item.name, 'Dinner');
  for (const quantity of [-1, 0, 1.5, '3', Infinity, 367]) assert.throws(() => policy.verifyAddon({ type: 'FOOD_2', quantity }, food, []));
  assert.throws(() => policy.verifyAddon({ type: 'FOOD_999', quantity: 1 }, food, []));
  assert.throws(() => policy.verifyAddon({ type: 'FOOD_2' }, [{ ...food[0], isActive: false }], []));
});

test('unblocking only part of a range preserves both remaining sides', () => {
  const original = { startDate: new Date('2026-12-01T00:00Z'), endDate: new Date('2026-12-10T23:59:59.999Z') };
  const result = ranges.subtractInterval(original, ranges.calendarDayInterval(new Date('2026-12-05')));
  assert.deepEqual(result.map(part => [part.startDate.toISOString(), part.endDate.toISOString()]), [
    ['2026-12-01T00:00:00.000Z', '2026-12-04T23:59:59.999Z'],
    ['2026-12-06T00:00:00.000Z', '2026-12-10T23:59:59.999Z'],
  ]);
  assert.deepEqual(ranges.subtractInterval(original, original), []);
  assert.deepEqual(ranges.subtractInterval(original, ranges.calendarDayInterval(new Date('2026-12-20'))), [original]);
});

test('recurring February 29 rate does not become a March 1 rate', () => {
  const { expandRecurringPricing } = load('src/lib/pricing.ts');
  const rules = expandRecurringPricing([{ id: 1, propertyId: 1, date: new Date('2024-02-29'), priceOverride: 999, createdAt: new Date(), updatedAt: new Date() }], 8);
  assert.ok(rules.length);
  assert.ok(rules.every(rule => rule.date.getUTCMonth() === 1 && rule.date.getUTCDate() === 29));
});

test('every administrative action rejects an unauthenticated caller before DB access', async () => {
  const files = ['src/lib/actions.ts', 'src/app/admin/bookings/actions.ts', 'src/app/admin/calendar/actions.ts', 'src/app/admin/settings/service-actions.ts', 'src/app/admin/servicios-comida/actions.ts', 'src/app/admin/tours-bookings/actions.ts'];
  for (const file of files) {
    const actions = load(file, { '@/lib/auth': { requireAdmin: async () => { throw new Error('Unauthorized'); } }, '@/lib/prisma': {}, './prisma': {}, './icalSync': {}, 'next/cache': { revalidatePath() {} } });
    for (const [name, action] of Object.entries(actions)) await assert.rejects(() => action(), /Unauthorized/, `${file}:${name}`);
  }
});

test('all admin APIs and private invoices reject visitors', async () => {
  const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : /route\.tsx?$/.test(entry.name) ? [path.join(directory, entry.name)] : []);
  const files = [...walk('src/app/api/admin').filter(file => !/\/(login|logout)\//.test(file)), 'src/app/api/invoice/route.ts', 'src/app/api/invoice/[bookingId]/route.tsx', 'src/app/api/invoice/tour/[serviceBookingId]/route.tsx'];
  const mocks = { '@/lib/auth': { getSession: async () => null }, '@/lib/prisma': {}, 'next/server': { NextResponse }, 'next/cache': {}, '@/lib/siteImages.server': {}, '@/lib/resend': {}, '@/components/pdf/InvoiceDocument': {}, '@/components/pdf/InvoicePDF': {}, '@/components/pdf/TourInvoicePDF': {} };
  for (const file of files) {
    const routes = load(file, mocks);
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) if (routes[method]) assert.equal((await routes[method](request({}), { params: Promise.resolve({}) })).status, 401, `${file}:${method}`);
  }
});

test('cron rejects default password and spoofed Vercel user-agent', async () => {
  const saved = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  const route = load('src/app/api/cron/ical/route.ts', { 'next/server': { NextResponse }, '@/lib/icalSync': {} });
  assert.equal((await route.GET(new Request('http://localhost/api/cron/ical?secret=caballosonador8', { headers: { 'user-agent': 'vercel-cron/1.0' } }))).status, 401);
  process.env.CRON_SECRET = 'test-only-secret';
  assert.equal((await route.GET(new Request('http://localhost/api/cron/ical', { headers: { 'authorization': 'Bearer wrong' } }))).status, 401);
  if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved;
});

test('checkout rejects currency tampering and invalid dates without creating reservations', async () => {
  const mocks = { 'next/server': { NextResponse }, '@/lib/stripe': {}, '@/lib/prisma': {}, '@/lib/bookingPolicy': policy };
  for (const file of ['src/app/api/checkout_sessions/route.ts', 'src/app/api/checkout_services/route.ts']) {
    const route = load(file, mocks);
    for (const body of [{}, { currency: 'usd', totalPrice: 1 }, { startDate: '2026-02-30', endDate: '2026-01-01', serviceType: 'TOUR' }]) assert.equal((await route.POST(request(body))).status, 400);
  }
});

test('Stripe never confirms an unpaid checkout and retries database failures', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'unit-test-only';
  let event = { type: 'checkout.session.completed', data: { object: { payment_status: 'unpaid' } } };
  const mocks = { 'next/server': { NextResponse }, '@/lib/stripe': { stripe: { webhooks: { constructEvent: () => event } } }, '@/lib/prisma': { booking: { findUnique: async () => { throw new Error('DB unavailable'); } } }, '@/lib/resend': {}, '@/lib/pdf': {} };
  const route = load('src/app/api/webhooks/stripe/route.ts', mocks);
  const webhookRequest = () => new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 'test' }, body: '{}' });
  assert.equal((await route.POST(webhookRequest())).status, 200);
  event = { type: 'checkout.session.completed', data: { object: { payment_status: 'paid', metadata: { bookingId: '1' } } } };
  assert.equal((await route.POST(webhookRequest())).status, 500);
  assert.equal((await route.POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body: '{}' }))).status, 400);
});

test('site editors require a fresh Supabase identity, active role and a linked site profile', async () => {
  const user={id:1,email:'owner@example.test',role:'SUPERADMIN'};
  let allowed=true,linked=true,role='owner';
  const auth=load('src/lib/auth.ts',{
    '@/lib/prisma':{$queryRaw:async()=>linked?[user]:[]},
    '@/lib/cala/access': { requireCalaAccess: async () => {
      if (!allowed) throw new Error('revoked');
      const client = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { key: role } }) }) }) }) };
      return {user:{id:'verified-supabase-user'},member:{role_id:'role',all_properties:true},client};
    } },
  });
  assert.ok(await auth.getSession());linked=false;assert.equal(await auth.getSession(),null);
  linked=true;role='viewer';assert.equal(await auth.getSession(),null);
  role='owner';allowed=false;assert.equal(await auth.getSession(),null);
});

test('an iCal fetch failure preserves previous blocks', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('Remote unavailable'); };
  let transactionCalls = 0;
  const sync = load('src/lib/icalSync.ts', {
    '@/lib/prisma': { $transaction: async () => { transactionCalls++; }, icalSource: { update: async () => ({}) } },
    'next/cache': { revalidatePath() {} },
  });
  try {
    const result = await sync.syncSingleIcalSource({ id: 1, propertyId: 1, name: 'External', url: 'https://example.com/calendar.ics' });
    assert.equal(result.success, false);
    assert.equal(transactionCalls, 0);
  } finally { global.fetch = originalFetch; }
});

test('UTC booking dates retain their selected day when displayed in Mexico', () => {
  const originalTZ = process.env.TZ;
  process.env.TZ = 'America/Mexico_City';
  try {
    const day = ranges.calendarDateToLocal('2026-12-05T00:00:00Z');
    assert.equal(day.getFullYear(), 2026);
    assert.equal(day.getMonth(), 11);
    assert.equal(day.getDate(), 5);
    assert.equal(day.getHours(), 0);
  } finally {
    if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ;
  }
});

test('expired holds never block the administrative calendar', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  assert.equal(policy.isActiveBookingRecord({ payment_status: 'EXPIRED', createdAt: now }, now), false);
  assert.equal(policy.isActiveBookingRecord({ payment_status: 'PENDING', createdAt: '2026-11-07T11:00:00Z' }, now), false);
  assert.equal(policy.isActiveBookingRecord({ payment_status: 'PENDING', createdAt: '2026-11-07T11:40:00Z' }, now), true);
  assert.equal(policy.isActiveBookingRecord({ payment_status: 'PAID', createdAt: '2026-11-01T00:00:00Z' }, now), true);
  assert.equal(policy.isActiveServiceRecord({ paymentStatus: 'EXPIRED', createdAt: now }, now), false);
});

test('payment notification retries use existing fields and preserve the paid reservation', async () => {
  const savedSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = 'unit-test-only';
  const booking = { id: 7, payment_status: 'PENDING', externalId: 'cs_existing', totalPrice: 500,
    guestName: 'Guest', guestEmail: 'guest@example.com', checkIn: new Date('2026-12-01'), checkOut: new Date('2026-12-03'),
    createdAt: new Date('2026-11-01'), property: { name: 'Casa', adminEmails: '' }, addons: [], depositPaid: 0, depositCurrency: 'MXN' };
  const writes = [];
  let failEmail = true;
  const keys = [];
  const email = async data => { keys.push(data.idempotencyKey); return { success: !failEmail }; };
  const route = load('src/app/api/webhooks/stripe/route.ts', {
    'next/server': { NextResponse },
    '@/lib/stripe': { stripe: { webhooks: { constructEvent: () => ({ type: 'checkout.session.completed', data: { object: {
      id: 'cs_existing', payment_status: 'paid', amount_total: 50000, currency: 'mxn', metadata: { bookingId: '7' },
    } } }) } } },
    '@/lib/prisma': { $transaction: async function(work){return work(this);}, booking: {
      findUnique: async () => ({ ...booking }),
      update: async ({ data }) => { assert.equal(Object.hasOwn(data, 'notificationsSentAt'), false); writes.push({ ...data }); Object.assign(booking, data); return { ...booking }; },
    } },
    '@/lib/resend': { sendBookingConfirmation: email, sendInvoiceEmail: email, sendAdminBookingNotification: async () => ({ success: true }) },
    '@/lib/pdf': { generateInvoicePDFBuffer: async () => Buffer.from('test invoice') },
  });
  const invoke = () => route.POST(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', headers: { 'stripe-signature': 'test' }, body: '{}' }));
  try {
    assert.equal((await invoke()).status, 500);
    assert.equal(booking.payment_status, 'PAID');
    assert.equal(booking.guestEmail, 'guest@example.com');
    failEmail = false;
    assert.equal((await invoke()).status, 200);
    assert.equal(booking.payment_status, 'CONFIRMED');
    assert.equal(keys[0], keys[1]);
    const count = writes.length;
    assert.equal((await invoke()).status, 200);
    assert.equal(writes.length, count, 'an already confirmed historical record must not be rewritten');
  } finally {
    if (savedSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = savedSecret;
  }
});

test('image versions use the existing SiteImage model and never belong to another image', () => {
  const history = load('src/lib/imageHistory.ts');
  const record = history.imageSnapshot({ id: 12, name: 'Hero', url: 'https://example.com/original.webp' });
  assert.equal(record.url, 'https://example.com/original.webp');
  assert.equal(history.isHistoryOf(record, 12), true);
  assert.equal(history.isHistoryOf(record, 1), false);
  assert.equal(history.isHistoryOf({ ...record, group: 'HOMEPAGE' }, 12), false);
  assert.ok(record.key.length < 255);
});

test('clearing pending holds keeps reservation records', async () => {
  let change;
  const actions = load('src/app/admin/bookings/actions.ts', {
    '@/lib/auth': { requireAdmin: async () => ({ user: { id: 1 } }) },
    '@/lib/prisma': { booking: { updateMany: async args => { change = args; return { count: 2 }; } } },
    'next/cache': { revalidatePath() {} },
  });
  const result = await actions.clearPendingBookings(false);
  assert.equal(result.success, true);
  assert.equal(change.where.payment_status, 'PENDING');
  assert.equal(change.data.payment_status, 'EXPIRED');
  assert.ok(change.where.createdAt.lt instanceof Date);
});

test('image history restores the previous image using only the existing image records', async () => {
  const { DEFAULT_IMAGES } = load('src/lib/siteImages.ts');
  const helpers = load('src/lib/imageHistory.ts');
  const key = Object.keys(DEFAULT_IMAGES)[0];
  const main = { id: 42, key, name: 'Hero', group: DEFAULT_IMAGES[key].group, url: 'https://example.com/current.webp', updatedAt: new Date() };
  const prior = { id: 99, ...helpers.imageSnapshot({ ...main, url: 'https://example.com/previous.webp' }), createdAt: new Date() };
  const copies = [];
  const prisma = { siteImage: {
    findMany: async ({ where }) => where.group === helpers.IMAGE_HISTORY_GROUP ? [prior] : [main],
    findUnique: async ({ where }) => where.key === key ? main : where.id === prior.id ? prior : null,
    create: async ({ data }) => { copies.push(data); return { id: 100, ...data }; },
    update: async ({ data }) => Object.assign(main, data),
  }, $transaction: values => Promise.all(values) };
  const mocks = { '@/lib/prisma': prisma, '@/lib/auth': { getSession: async () => ({ user: { id: 1 } }) }, 'next/server': { NextResponse }, 'next/cache': { revalidatePath() {} } };
  const list = await load('src/app/api/admin/images/route.ts', mocks).GET();
  const groups = await list.json();
  const listed = Object.values(groups).flat().find(image => image.key === key);
  assert.equal(listed.history[0].url, prior.url);
  assert.equal(Object.hasOwn(groups, helpers.IMAGE_HISTORY_GROUP), false);
  const result = await load('src/app/api/admin/images/restore/route.ts', mocks).POST(request({ key, historyId: prior.id }));
  assert.equal(result.status, 200);
  assert.equal(main.url, 'https://example.com/previous.webp');
  assert.equal(copies[0].url, 'https://example.com/current.webp');
});

test('CALA confirmation does not skip a verified Stripe event before its notification receipt exists', async () => {
  const previous=process.env.DATA_BACKEND;process.env.DATA_BACKEND='supabase';process.env.STRIPE_WEBHOOK_SECRET='unit-test-only';let accepted=0;
  const event={id:'evt_fixture',type:'checkout.session.completed',data:{object:{id:'cs_fixture',payment_status:'paid',amount_total:3000000,currency:'mxn',metadata:{bookingId:'1'}}}};
  const route=load('src/app/api/webhooks/stripe/route.ts',{'next/server':{NextResponse},'@/lib/stripe':{stripe:{webhooks:{constructEvent:()=>event}}},'@/lib/prisma':{booking:{findUnique:async()=>({id:1,payment_status:'CONFIRMED',externalId:'cs_fixture'})},$queryRaw:async strings=>{if(strings[0].includes('stripe_receipts'))return [];accepted++;return [{accepted:false}];}},'@/lib/resend':{},'@/lib/pdf':{}});
  try{const response=await route.POST(new Request('http://localhost/api/webhooks/stripe',{method:'POST',headers:{'stripe-signature':'test'},body:'{}'}));assert.equal(response.status,200);assert.equal((await response.json()).reviewRequired,true);assert.equal(accepted,1);}finally{if(previous===undefined)delete process.env.DATA_BACKEND;else process.env.DATA_BACKEND=previous;}
});

test('existing iCal URLs export opaque all-day busy events without internal or payment identifiers',async()=>{
 const id='d0000000-0000-0000-0000-000000000001';
 const route=load('src/lib/cala/legacy-ical.ts',{'./config':{calaConfiguration:()=>({ready:true})},'@/lib/prisma':{$queryRaw:async()=>[{events:[{kind:'reservation',id,arrival:'2030-01-10',departure:'2030-01-12',sequence:4}]}]}});
 const response=await route.legacyCalendar('1'),text=await response.text();assert.equal(response.status,200);assert.match(text,/UID:[a-f0-9]{64}@cala\.local/);assert.match(text,/DTEND;VALUE=DATE:20300112/);assert.equal(text.includes(id),false);assert.match(text,/SUMMARY:No disponible/);
 assert.equal((await route.legacyCalendar('1 OR 1=1')).status,400);
});

test('an unexpanded recurring iCal feed cannot erase previously occupied dates',async()=>{
 const originalFetch=global.fetch;global.fetch=async()=>new Response('BEGIN:VCALENDAR\nEND:VCALENDAR');let writes=0;
 const sync=load('src/lib/icalSync.ts',{'node-ical':{parseICS:()=>({event:{type:'VEVENT',uid:'external',rrule:{}}})},'@/lib/prisma':{$transaction:async()=>{writes++;},icalSource:{update:async()=>({})}},'next/cache':{revalidatePath(){}}});
 try{const result=await sync.syncSingleIcalSource({id:1,propertyId:1,name:'External fixture',url:'https://example.test/feed.ics'});assert.equal(result.success,false);assert.equal(writes,0);}finally{global.fetch=originalFetch;}
});

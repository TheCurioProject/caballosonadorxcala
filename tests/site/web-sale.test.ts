import { beforeAll, afterAll, test, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";

// A room bought and paid on the website, end to end in the database:
// it appears in CALA (reservation, folio, Stripe payment, guest language),
// rings the bell / push of the roles that handle bookings and money (never
// housekeeping), and blocks the OTAs through every iCal feed it touches
// (the room and the whole house) from the moment the guest presses "Pay".
let db: PGlite;
const people = {
  owner: "b2000000-0000-0000-0000-000000000001",
  desk: "b2000000-0000-0000-0000-000000000002",
  money: "b2000000-0000-0000-0000-000000000003",
  house: "b2000000-0000-0000-0000-000000000004",
};
let scope: { organizationId: string; defaultPropertyId: string };
let rooms: Array<{ id: string; unit_id: string }> = [];
let house: { id: string; unit_id: string };
const feeds = { house: "a".repeat(64), room0: "b".repeat(64), room1: "c".repeat(64) };

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid(),auth.jwt() to authenticated,service_role;grant usage on schema public to service_role;`,
  );
  for (const name of readdirSync("supabase/migrations").filter((n) => n.endsWith(".sql")).sort())
    await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
  for (const [key, id] of Object.entries(people))
    await db.query("insert into auth.users(id,email) values($1,$2)", [id, `${key}@example.test`]);
  scope = (await db.query<{ data: typeof scope }>("select site.bootstrap_cala($1) as data", [people.owner])).rows[0].data;
  const role = (key: string) => `(select id from public.roles where key='${key}' and organization_id is null)`;
  await db.exec(
    `insert into public.organization_members(organization_id,user_id,role_id,all_properties) values` +
      `('${scope.organizationId}','${people.desk}',${role("front_desk")},true),` +
      `('${scope.organizationId}','${people.money}',${role("finance")},true),` +
      `('${scope.organizationId}','${people.house}',${role("housekeeping")},true);`,
  );
  await db.exec(
    `insert into site.lodgings(site_property_id,unit_id,inventory_type_id,rate_plan_id,kind,slug,name_es,min_stay,turnover_nights) select site_property_id,unit_id,inventory_type_id,rate_plan_id,'whole_home','casa','Casa completa',2,0 from pms_private.site_property_map;`,
  );
  for (let i = 1; i <= 2; i++) {
    const type = (
      await db.query<{ id: string }>(
        "insert into public.inventory_types(organization_id,property_id,name,sell_mode,max_occupancy,base_rate_minor) values($1,$2,$3,'unit',2,100000) returning id",
        [scope.organizationId, scope.defaultPropertyId, "Habitación " + i],
      )
    ).rows[0].id;
    const unit = (
      await db.query<{ id: string }>(
        "insert into public.units(organization_id,property_id,inventory_type_id,name,parent_unit_id) select organization_id,property_id,$1,$2,unit_id from pms_private.site_property_map returning id",
        [type, `Room ${i}- Habitación ${i}`],
      )
    ).rows[0].id;
    await db.query(
      "insert into site.lodgings(site_property_id,unit_id,inventory_type_id,rate_plan_id,kind,slug,name_es) select site_property_id,$1,$2,rate_plan_id,'room',$3,$4 from pms_private.site_property_map",
      [unit, type, "room-" + i, "Habitación " + i],
    );
  }
  const lodgings = (await db.query<{ id: string; unit_id: string; kind: string }>("select id,unit_id,kind from site.lodgings order by slug")).rows;
  house = lodgings.find((l) => l.kind === "whole_home")!;
  rooms = lodgings.filter((l) => l.kind === "room");
  // The export links pasted into Airbnb / Booking: one for the house, one per room.
  for (const [token, unit] of [[feeds.house, house.unit_id], [feeds.room0, rooms[0].unit_id], [feeds.room1, rooms[1].unit_id]])
    await db.query(
      "insert into public.ical_feeds(organization_id,property_id,unit_id,token_hash,created_by) values($1,$2,$3,$4,$5)",
      [scope.organizationId, scope.defaultPropertyId, unit, createHash("sha256").update(token).digest("hex"), people.owner],
    );
  // Owner enabled browser notifications on a phone.
  await db.query(
    "insert into public.push_subscriptions(user_id,organization_id,endpoint,p256dh,auth) values($1,$2,'https://push.example.test/owner',$3,'authsecret1')",
    [people.owner, scope.organizationId, "p".repeat(40)],
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});

/** What the guest's "Pay" button stores (checkout_sessions route): one PENDING site booking + its room. */
async function checkout(lodging: string, start: string, end: string, session: string, lang = "es") {
  await db.exec("begin");
  const id = (
    await db.query<{ id: number }>(
      `insert into site.reservas(property_id,start_date,end_date,"guestName","guestEmail","guestPhone",payment_status,origin,"totalPrice","externalId",invoice_language,updated_at) values(1,$1,$2,'Ana Web','ana@example.test','+523312345678','PENDING','WEBSITE',3000,$3,$4,now()) returning id`,
      [start, end, session, lang],
    )
  ).rows[0].id;
  await db.query("insert into site.booking_lodging values($1,$2,2,0)", [id, lodging]);
  await db.exec("commit");
  return id;
}
async function calaStay(siteId: number) {
  return (
    await db.query<{ id: string; status: string; source: string; code: string; unit_id: string; language: string; email: string }>(
      `select r.id,r.status,r.source,r.confirmation_code as code,ru.unit_id,g.language,g.email from pms_private.site_booking_map m join public.reservations r on r.id=m.reservation_id join public.reservation_units ru on ru.reservation_id=r.id join public.guests g on g.id=r.guest_id where m.site_booking_id=$1`,
      [siteId],
    )
  ).rows[0];
}
async function feed(token: string) {
  await db.exec("set role anon");
  try {
    const data = (await db.query<{ c: { events: Array<{ arrival: string; departure: string; cancelled: boolean }> } }>("select public.pms_public_calendar($1) c", [token])).rows[0].c;
    return data.events;
  } finally {
    await db.exec("reset role");
  }
}
const busy = (events: Awaited<ReturnType<typeof feed>>, start: string, end: string) =>
  events.some((e) => !e.cancelled && e.arrival < end && e.departure > start);
async function bell(user: string) {
  return (
    await db.query<{ kind: string; body: string; url: string }>(
      "select kind,body,url from public.notifications where user_id=$1 order by kind",
      [user],
    )
  ).rows;
}

test("a paid website room is confirmed in CALA, notifies the right roles and stays blocked on every OTA feed", async () => {
  const start = day(20), end = day(23);
  const id = await checkout(rooms[0].id, start, end, "cs_web_sale");

  // "Pay" pressed: CALA holds it as pending and the OTAs already see those dates busy (room + whole house).
  let stay = await calaStay(id);
  expect(stay).toMatchObject({ status: "pending", source: "website", code: `WEB-${id}`, unit_id: rooms[0].unit_id, language: "es", email: "ana@example.test" });
  expect(busy(await feed(feeds.room0), start, end)).toBe(true);
  expect(busy(await feed(feeds.house), start, end)).toBe(true);
  expect(busy(await feed(feeds.room1), start, end)).toBe(false);
  // Nobody is told about an unpaid checkout.
  expect(await bell(people.owner)).toEqual([]);

  // Stripe confirms (webhook, or the reconcile cron) — twice, as Stripe retries.
  for (let attempt = 0; attempt < 2; attempt++)
    expect(
      (await db.query<{ ok: boolean }>("select site.accept_stripe_payment($1,'evt_web_sale','cs_web_sale',300000,'MXN') ok", [id])).rows[0].ok,
    ).toBe(true);

  stay = await calaStay(id);
  expect(stay.status).toBe("confirmed");
  const payments = (await db.query<{ provider: string; amount_minor: number; status: string }>("select provider,amount_minor,status from public.payments where reservation_id=$1", [stay.id])).rows;
  expect(payments).toEqual([{ provider: "stripe", amount_minor: 300000, status: "succeeded" }]);
  const folio = (await db.query<{ total: number }>("select sum(i.total_minor)::int total from public.folio_items i join public.folios f on f.id=i.folio_id where f.reservation_id=$1", [stay.id])).rows[0];
  expect(Number(folio.total)).toBe(300000);
  expect((await db.query<{ payment_status: string }>("select payment_status from site.reservas where id=$1", [id])).rows[0].payment_status).toBe("PAID");

  // Bell: bookings → whoever writes reservations; money → whoever reads finance; housekeeping hears nothing.
  const owner = await bell(people.owner);
  expect(owner.map((n) => n.kind)).toEqual(["payment.received", "reservation.created"]);
  expect(owner.find((n) => n.kind === "reservation.created")!.body).toContain("Ana Web");
  expect(owner.find((n) => n.kind === "reservation.created")!.url).toBe(`/admin/reservas/?reservation=${stay.id}`);
  expect((await bell(people.desk)).map((n) => n.kind)).toEqual(["payment.received", "reservation.created"]);
  expect((await bell(people.money)).map((n) => n.kind)).toEqual(["payment.received"]);
  expect(await bell(people.house)).toEqual([]);

  // Push: each notice is handed out once, to the devices of its recipient.
  await db.exec("set role service_role");
  const claimed = (await db.query<{ c: Array<{ kind: string; subscriptions: unknown[] }> }>("select public.pms_service_push_claim(50) c")).rows[0].c;
  await db.exec("reset role");
  expect(claimed.filter((n) => n.subscriptions.length).map((n) => n.kind).sort()).toEqual(["payment.received", "reservation.created"]);
  await db.exec("set role service_role");
  expect((await db.query<{ c: unknown[] }>("select public.pms_service_push_claim(50) c")).rows[0].c).toEqual([]);
  await db.exec("reset role");

  // OTAs keep seeing it busy after payment.
  expect(busy(await feed(feeds.room0), start, end)).toBe(true);
  expect(busy(await feed(feeds.house), start, end)).toBe(true);
});

test("an English guest keeps English in CALA (guest e-mails use it)", async () => {
  const id = await checkout(rooms[1].id, day(40), day(42), "cs_web_en", "en");
  await db.query("select site.accept_stripe_payment($1,'evt_web_en','cs_web_en',300000,'MXN')", [id]);
  expect((await calaStay(id)).language).toBe("en");
});

test("an abandoned checkout frees the OTAs again and is not announced as a cancellation", async () => {
  const start = day(60), end = day(62);
  const id = await checkout(rooms[1].id, start, end, "cs_web_gone");
  expect(busy(await feed(feeds.room1), start, end)).toBe(true);
  const before = (await bell(people.owner)).length;
  // expireSessionRecords: Stripe session expired unpaid.
  await db.query("update site.reservas set payment_status='EXPIRED',updated_at=now() where id=$1", [id]);
  expect((await calaStay(id)).status).toBe("cancelled");
  expect(busy(await feed(feeds.room1), start, end)).toBe(false);
  expect(busy(await feed(feeds.house), start, end)).toBe(false);
  expect((await bell(people.owner)).length).toBe(before);
});

test("paid after the dates were taken: CALA keeps a draft, alerts finance and does not block the OTAs twice", async () => {
  const start = day(80), end = day(82);
  const late = await checkout(rooms[0].id, start, end, "cs_web_late");
  // Hold expired, then someone else took the room before the late payment arrived.
  await db.query("update site.reservas set payment_status='EXPIRED',updated_at=now() where id=$1", [late]);
  const other = await checkout(rooms[0].id, start, end, "cs_web_other");
  await db.query("select site.accept_stripe_payment($1,'evt_other','cs_web_other',300000,'MXN')", [other]);
  const ok = (await db.query<{ ok: boolean }>("select site.accept_stripe_payment($1,'evt_late','cs_web_late',300000,'MXN') ok", [late])).rows[0].ok;
  expect(ok).toBe(false);
  expect((await calaStay(late)).status).toBe("draft");
  expect((await bell(people.money)).map((n) => n.kind)).toContain("payment.review");
  expect((await bell(people.house)).map((n) => n.kind)).not.toContain("payment.review");
});

import { beforeAll, afterAll, test, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

// Retreats close every room of the website house for their dates; a sale swaps
// the room's retreat block for the guest's reservation, and OTA echoes of the
// closed dates never come back as blocks.
let db: PGlite;
const owner = "b1000000-0000-0000-0000-000000000001";
let scope: { organizationId: string; defaultPropertyId: string };
let rooms: Array<{ id: string; unit_id: string }>;
let whole: { id: string; unit_id: string };

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`,
  );
  for (const name of readdirSync("supabase/migrations").filter((n) => n.endsWith(".sql")).sort())
    await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
  await db.query("insert into auth.users values($1,$2)", [owner, "owner@example.test"]);
  scope = (await db.query<{ data: typeof scope }>("select site.bootstrap_cala($1) as data", [owner])).rows[0].data;
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
        [type, "Habitación " + i],
      )
    ).rows[0].id;
    await db.query(
      "insert into site.lodgings(site_property_id,unit_id,inventory_type_id,rate_plan_id,kind,slug,name_es,turnover_nights) select site_property_id,$1,$2,rate_plan_id,'room',$3,$4,1 from pms_private.site_property_map",
      [unit, type, "room-" + i, "Habitación " + i],
    );
  }
  rooms = (await db.query<{ id: string; unit_id: string }>("select id,unit_id from site.lodgings where kind='room' order by slug")).rows;
  whole = (await db.query<{ id: string; unit_id: string }>("select id,unit_id from site.lodgings where kind='whole_home'")).rows[0];
}, 60000);
afterAll(async () => {
  await db?.close();
});

const org = () => scope.organizationId;
async function retreat(start: string, end: string, stock = 2, price = 1500000) {
  const id = (
    await db.query<{ id: number }>(
      `insert into site.writers_workshops(title_es,title_en,description_es,description_en,is_active,updated_at,starts_on,ends_on,stock,price_minor) values('Retiro de yoga','Yoga retreat','x','x',true,now(),$1,$2,$3,$4) returning id`,
      [start, end, stock, price],
    )
  ).rows[0].id;
  return { id, sync: await sync(id) };
}
async function sync(id: number) {
  return (await db.query<{ data: { onSale: boolean; rooms: Array<{ lodgingId: string; state: string }> } }>("select site.retreat_sync($1,$2) as data", [id, org()])).rows[0].data;
}
async function offer(id: number) {
  const all = (await db.query<{ data: Array<{ id: number; sold: number; onSale: boolean; rooms: Array<{ lodgingId: string; available: boolean }> }> }>("select site.retreat_offers($1) as data", [org()])).rows[0].data;
  return all.find((r) => r.id === id)!;
}
async function hold(id: number, lodging: string, guests = 2) {
  await db.exec("begin");
  try {
    const sid = (
      await db.query<{ id: number }>("select site.retreat_hold($1,$2,$3,$4,$5) as id", [
        id,
        lodging,
        guests,
        JSON.stringify({ name: "Ana Pérez", email: "ana@example.test", phone: "+5215512345678", lang: "es" }),
        org(),
      ])
    ).rows[0].id;
    await db.exec("commit");
    return sid;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}
async function quote(lodging: string, start: string, end: string) {
  return db.query("select site.lodging_quote($1,$2,$3,2,0,$4) as total", [lodging, start, end, org()]);
}
const blockStatus = async (id: number, lodging: string) =>
  (await db.query<{ status: string }>("select b.status from site.retreat_rooms rr join public.inventory_blocks b on b.id=rr.block_id where rr.retreat_id=$1 and rr.lodging_id=$2", [id, lodging])).rows[0]?.status;
const reservation = async (sid: number) =>
  (await db.query<{ status: string; arrival_date: string; unit_id: string; adults: number }>(
    "select r.status,r.arrival_date::text,ru.unit_id,r.adults from pms_private.site_booking_map m join public.reservations r on r.id=m.reservation_id join public.reservation_units ru on ru.reservation_id=r.id where m.site_booking_id=$1",
    [sid],
  )).rows[0];

test("a retreat closes every room and the whole house for the public, only inside its dates", async () => {
  const { id, sync: s } = await retreat("2034-03-10", "2034-03-15");
  expect(s.onSale).toBe(true);
  expect(s.rooms.map((r) => r.state)).toEqual(["open", "open"]);
  for (const l of [...rooms, whole]) await expect(quote(l.id, "2034-03-11", "2034-03-13")).rejects.toThrow();
  await expect(quote(rooms[0].id, "2034-03-15", "2034-03-17")).resolves.toBeTruthy();
  const o = await offer(id);
  expect(o.onSale).toBe(true);
  expect(o.sold).toBe(0);
  expect(o.rooms.every((r) => r.available)).toBe(true);
  // CALA users cannot move or delete a retreat block by hand.
  const block = (await db.query<{ block_id: string }>("select block_id from site.retreat_rooms where retreat_id=$1 limit 1", [id])).rows[0].block_id;
  await expect(db.query("update public.inventory_blocks set status='released' where id=$1", [block])).rejects.toThrow(/RETREAT_BLOCK_MANAGED/);
  await expect(db.query("delete from public.inventory_blocks where id=$1", [block])).rejects.toThrow(/RETREAT_BLOCK_MANAGED/);
});

test("selling swaps the room block for a reservation; an expired sale gives the room back", async () => {
  const { id } = await retreat("2034-04-10", "2034-04-14");
  const sid = await hold(id, rooms[0].id, 2);
  const r = await reservation(sid);
  expect(r).toMatchObject({ status: "pending", arrival_date: "2034-04-10", unit_id: rooms[0].unit_id, adults: 2 });
  expect(await blockStatus(id, rooms[0].id)).toBe("released");
  expect(await blockStatus(id, rooms[1].id)).toBe("active");
  let o = await offer(id);
  expect(o.sold).toBe(1);
  expect(o.rooms.find((x) => x.lodgingId === rooms[0].id)!.available).toBe(false);
  // The same room cannot be sold twice.
  await expect(hold(id, rooms[0].id)).rejects.toThrow(/RETREAT_ROOM_TAKEN/);
  // Public still cannot book the sold room.
  await expect(quote(rooms[0].id, "2034-04-11", "2034-04-13")).rejects.toThrow();

  await db.query("update site.reservas set payment_status='EXPIRED',updated_at=now() where id=$1", [sid]);
  expect((await reservation(sid)).status).toBe("cancelled");
  expect(await blockStatus(id, rooms[0].id)).toBe("active");
  o = await offer(id);
  expect(o.sold).toBe(0);
  expect(o.rooms.every((x) => x.available)).toBe(true);
  await expect(quote(rooms[0].id, "2034-04-11", "2034-04-13")).rejects.toThrow();
});

test("stock limits sales, capacity and dates are enforced, and live sales lock the dates", async () => {
  const { id } = await retreat("2034-05-10", "2034-05-12", 1);
  await expect(hold(id, rooms[0].id, 3)).rejects.toThrow(/RETREAT_GUESTS/);
  const sid = await hold(id, rooms[0].id, 1);
  await expect(hold(id, rooms[1].id, 1)).rejects.toThrow(/RETREAT_SOLD_OUT/);
  await db.query("update site.writers_workshops set ends_on='2034-05-13' where id=$1", [id]);
  await expect(sync(id)).rejects.toThrow(/RETREAT_HAS_BOOKINGS/);
  await db.query("update site.writers_workshops set ends_on='2034-05-12' where id=$1", [id]);
  expect((await sync(id)).rooms.map((r) => r.state)).toEqual(["sold", "open"]);
  await expect(db.query("delete from site.writers_workshops where id=$1", [id])).rejects.toThrow(/RETREAT_HAS_BOOKINGS/);
  // Cancelling in CALA (via the website row) frees the place; then it can be deleted.
  await db.query("update site.reservas set payment_status='CANCELLED',updated_at=now() where id=$1", [sid]);
  expect(await blockStatus(id, rooms[0].id)).toBe("active");
  await db.query("delete from site.writers_workshops where id=$1", [id]);
  expect(
    (await db.query<{ n: number }>("select count(*)::int as n from public.inventory_blocks where reason like 'Retiro%' and status='active' and start_date='2034-05-10'")).rows[0].n,
  ).toBe(0);
  await expect(quote(rooms[1].id, "2034-05-10", "2034-05-12")).resolves.toBeTruthy();
});

test("a room already booked is left out of the retreat; switching it off frees every room", async () => {
  await db.exec("begin");
  const sid = (
    await db.query<{ id: number }>(
      `insert into site.reservas(property_id,start_date,end_date,"guestName","guestEmail",payment_status,origin,"totalPrice",updated_at) values(1,'2034-06-11','2034-06-13','Otro','otro@example.test','PENDING','WEBSITE',2000,now()) returning id`,
    )
  ).rows[0].id;
  await db.query("insert into site.booking_lodging values($1,$2,2,0)", [sid, rooms[1].id]);
  await db.exec("commit");
  const { id, sync: s } = await retreat("2034-06-10", "2034-06-14");
  expect(s.rooms.map((r) => r.state)).toEqual(["open", "busy"]);
  await expect(hold(id, rooms[1].id)).rejects.toThrow(/RETREAT_ROOM_TAKEN/);
  await db.query("update site.writers_workshops set is_active=false where id=$1", [id]);
  expect((await sync(id)).rooms.map((r) => r.state)).toEqual(["off", "off"]);
  await expect(quote(rooms[0].id, "2034-06-10", "2034-06-12")).resolves.toBeTruthy();
});

test("OTA echoes of retreat dates are ignored, real OTA bookings are not", async () => {
  const { id } = await retreat("2027-08-10", "2027-08-15");
  const link = (
    await db.query<{ id: string }>(
      "insert into public.calendar_links(organization_id,property_id,unit_id,provider,url) values($1,$2,$3,'booking','https://admin.booking.com/ical/x.ics') returning id",
      [org(), scope.defaultPropertyId, whole.unit_id],
    )
  ).rows[0].id;
  const apply = async (events: unknown[]) =>
    (await db.query<{ data: { created: number; echoed: number } }>("select public.pms_service_calendar_apply($1,$2,null) as data", [link, JSON.stringify(events)])).rows[0].data;
  const inside = { uid: "echo-1@booking.com", arrival: "2027-08-10", departure: "2027-08-15", cancelled: false };
  // Booking.com has not read CALA's feed since the retreat: it cannot be an echo.
  await db.query(
    "insert into public.ical_feeds(organization_id,property_id,unit_id,token_hash,created_by,provider,last_fetched_at) values($1,$2,$3,md5('t1')||md5('t2'),$4,'booking',now()-interval '1 day')",
    [org(), scope.defaultPropertyId, whole.unit_id, owner],
  );
  expect(await apply([inside])).toMatchObject({ created: 1, echoed: 0 });
  expect(await apply([])).toMatchObject({ created: 0 });
  // After it read the feed, the same dates coming back are an echo.
  await db.query("update public.ical_feeds set last_fetched_at=now()+interval '1 minute' where provider='booking'");
  expect(await apply([inside])).toMatchObject({ created: 0, echoed: 1 });
  expect((await offer(id)).rooms.every((r) => r.available)).toBe(true);
  // Still an echo on later syncs, even once the retreat is switched off.
  await db.query("update site.writers_workshops set is_active=false where id=$1", [id]);
  await sync(id);
  expect(await apply([inside])).toMatchObject({ created: 0, echoed: 1 });
  await db.query("update site.writers_workshops set is_active=true where id=$1", [id]);
  await sync(id);
  // A booking the OTA marks as a reservation, or nights CALA has free, are real.
  await db.query("update public.ical_feeds set last_fetched_at=now()+interval '2 minutes' where provider='booking'");
  const r = await apply([
    inside,
    { uid: "real-1@booking.com", arrival: "2027-08-11", departure: "2027-08-12", cancelled: false, confirmed: true },
    { uid: "real-2@booking.com", arrival: "2027-08-14", departure: "2027-08-17", cancelled: false },
  ]);
  expect(r).toMatchObject({ created: 2, echoed: 1 });
});

test("the booking total is the retreat price plus the room at CALA's rates for those nights", async () => {
  const { id } = await retreat("2034-08-10", "2034-08-13", 2, 500000);
  // One night with its own rate in the rates grid; the others use the base rate (1,000 MXN).
  const l = (await db.query<{ rate_plan_id: string; inventory_type_id: string }>("select rate_plan_id,inventory_type_id from site.lodgings where id=$1", [rooms[1].id])).rows[0];
  await db.query(
    "insert into public.rate_day(organization_id,property_id,rate_plan_id,inventory_type_id,stay_date,amount_minor,currency) values($1,$2,$3,$4,'2034-08-11',250000,'MXN')",
    [org(), scope.defaultPropertyId, l.rate_plan_id, l.inventory_type_id],
  );
  const o = (await offer(id)) as unknown as { rooms: Array<{ lodgingId: string; lodgingMinor: number }> };
  expect(o.rooms.find((r) => r.lodgingId === rooms[0].id)!.lodgingMinor).toBe(300000);
  expect(o.rooms.find((r) => r.lodgingId === rooms[1].id)!.lodgingMinor).toBe(100000 + 250000 + 100000);
  const sid = await hold(id, rooms[1].id, 1);
  const total = (await db.query<{ total: string }>(`select round("totalPrice"*100)::bigint::text as total from site.reservas where id=$1`, [sid])).rows[0].total;
  expect(Number(total)).toBe(500000 + 450000);
});

test("final-price coupons and read-only housekeeping are allowed by the database", async () => {
  await db.query("insert into site.coupons(code,discount_type,value) values('FINAL50','final',50)");
  const perms = (await db.query<{ permission_key: string }>("select rp.permission_key from public.role_permissions rp join public.roles r on r.id=rp.role_id where r.key='housekeeping' and r.organization_id is null order by 1")).rows.map((r) => r.permission_key);
  expect(perms).toContain("reservation.read");
  expect(perms).not.toContain("reservation.write");
  expect(perms).not.toContain("guest.pii.read");
});

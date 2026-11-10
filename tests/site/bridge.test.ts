import { beforeAll, afterAll, test, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite;
const owner = "b0000000-0000-0000-0000-000000000001";
let ids: { organizationId: string; defaultPropertyId: string };
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`,
  );
  for (const name of readdirSync("supabase/migrations")
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
  await db.query("insert into auth.users values($1,$2)", [
    owner,
    "owner@example.test",
  ]);
  ids = (
    await db.query<{ data: typeof ids }>(
      "select site.bootstrap_cala($1::uuid) as data",
      [owner],
    )
  ).rows[0].data;
}, 60000);
afterAll(async () => {
  await db?.close();
});
test('legacy calendar projection is private to the server and includes only busy event fields',async()=>{
 await booking('2032-01-01','2032-01-03','CONFIRMED');
 await db.exec('set role cala_site_app');
 const events=(await db.query<{events:Array<Record<string,unknown>>}>('select site.legacy_calendar(1) as events')).rows[0].events;
 expect(events.length).toBeGreaterThan(0);expect(Object.keys(events[0]).sort()).toEqual(['arrival','departure','id','kind','sequence']);
 await expect(db.exec('select * from public.reservations')).rejects.toThrow();
 await db.exec('reset role;set role anon');await expect(db.exec('select site.legacy_calendar(1)')).rejects.toThrow();await db.exec('reset role');
});
test('payment synchronization preserves a guest name split and the occupancy corrected in CALA',async()=>{
 const id=await booking('2032-02-01','2032-02-03','PENDING','cs_profile');
 const reservation=(await db.query<{reservation_id:string;guest_id:string}>('select m.reservation_id,r.guest_id from pms_private.site_booking_map m join public.reservations r on r.id=m.reservation_id where m.site_booking_id=$1',[id])).rows[0];
 await db.exec('begin');
 await db.query("update public.guests set first_name='Ana',last_name='Prueba' where id=$1",[reservation.guest_id]);
 await db.query('update public.reservations set adults=6,children=2 where id=$1',[reservation.reservation_id]);
 await db.query('update public.reservation_units set guests_count=8 where reservation_id=$1',[reservation.reservation_id]);await db.exec('commit');
 await db.query('select site.accept_stripe_payment($1,$2,$3,$4,$5)',[id,'evt_profile','cs_profile',3000000,'MXN']);
 expect((await db.query<{first_name:string;last_name:string}>('select first_name,last_name from public.guests where id=$1',[reservation.guest_id])).rows[0]).toEqual({first_name:'Ana',last_name:'Prueba'});
 expect((await db.query<{guests_count:number}>('select guests_count from public.reservation_units where reservation_id=$1',[reservation.reservation_id])).rows[0].guests_count).toBe(8);
});
async function booking(
  start: string,
  end: string,
  status = "PENDING",
  external: string | null = null,
) {
  return (
    await db.query<{ id: number }>(
      `insert into site.reservas(property_id,start_date,end_date,"guestName","guestEmail","guestPhone",payment_status,origin,"totalPrice","externalId",updated_at) values(1,$1,$2,'Prueba','guest@example.test','3312345678',$3,'WEBSITE',30000,$4,now()) returning id`,
      [start, end, status, external],
    )
  ).rows[0].id;
}
test("bootstrap is repeatable and creates one actual villa, linked owner and no public site access", async () => {
  const result = (
    await db.query<{ data: typeof ids }>(
      "select site.bootstrap_cala($1::uuid) as data",
      [owner],
    )
  ).rows[0].data;
  expect(result.organizationId).toBe(ids.organizationId);
  expect((await db.query("select * from public.units")).rows).toHaveLength(1);
  expect(
    (
      await db.query(
        'select * from site."AdminUser" where supabase_user_id=$1',
        [owner],
      )
    ).rows,
  ).toHaveLength(1);
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    await expect(db.exec("select * from site.reservas")).rejects.toThrow();
    await expect(
      db.exec(`select site.bootstrap_cala('${owner}')`),
    ).rejects.toThrow();
    await db.exec("reset role");
  }
});
test("website holds, extras, exclusive stays and inclusive preparation block commit together", async () => {
  await db.exec("begin");
  const id = await booking("2030-01-10", "2030-01-12");
  await db.query(
    "insert into site.booking_addons(booking_id,type,quantity,price) values($1,$2,2,2000)",
    [id, "FOOD"],
  );
  await db.exec("commit");
  const row = (
    await db.query<{ total_minor: number; status: string }>(
      `select r.total_minor,r.status from public.reservations r join pms_private.site_booking_map m on r.id=m.reservation_id where m.site_booking_id=$1`,
      [id],
    )
  ).rows[0];
  expect(Number(row.total_minor)).toBe(2800000);
  expect(row.status).toBe("pending");
  const availability = (
    await db.query<{
      data: { blocks: Array<{ startDate: string; endDate: string }> };
    }>("select site.cala_availability(1) as data")
  ).rows[0].data;
  expect(availability.blocks).toContainEqual({
    startDate: "2030-01-12",
    endDate: "2030-01-12",
  });
  await expect(booking("2030-01-12", "2030-01-14")).rejects.toThrow();
  const second = await booking("2030-01-13", "2030-01-15");
  expect(second).toBeGreaterThan(id);
});
test("CALA moves and cancellations mirror back to the website and keep the room price", async () => {
  const id = await booking("2030-02-01", "2030-02-03", "CONFIRMED");
  const rid = (
    await db.query<{ reservation_id: string }>(
      "select reservation_id from pms_private.site_booking_map where site_booking_id=$1",
      [id],
    )
  ).rows[0].reservation_id;
  await db.exec("begin");
  await db.query(
    "update public.reservations set arrival_date='2030-02-05',departure_date='2030-02-07',version=version+1 where id=$1",
    [rid],
  );
  await db.query(
    "update public.reservation_units set arrival_date='2030-02-05',departure_date='2030-02-07' where reservation_id=$1",
    [rid],
  );
  await db.exec("commit");
  const row = (
    await db.query<{ start: string; price: number }>(
      'select start_date::date::text as start,"totalPrice" as price from site.reservas where id=$1',
      [id],
    )
  ).rows[0];
  expect(row.start).toBe("2030-02-05");
  expect(row.price).toBe(30000);
  await db.query(
    "update public.reservations set status='cancelled',version=version+1 where id=$1",
    [rid],
  );
  expect(
    (
      await db.query<{ payment_status: string }>(
        "select payment_status from site.reservas where id=$1",
        [id],
      )
    ).rows[0].payment_status,
  ).toBe("CANCELLED");
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int as n from public.inventory_blocks b join pms_private.site_booking_map m on b.id=m.buffer_id where m.site_booking_id=$1 and b.status=$2",
        [id, "active"],
      )
    ).rows[0].n,
  ).toBe(0);
});
test("canonical rates price website quotes and restrictive dates reject checkout", async () => {
  const m = (
    await db.query<{
      organization_id: string;
      property_id: string;
      inventory_type_id: string;
      rate_plan_id: string;
    }>("select * from pms_private.site_property_map where site_property_id=1")
  ).rows[0];
  await db.query(
    "insert into public.rate_day(organization_id,property_id,rate_plan_id,inventory_type_id,stay_date,amount_minor,currency,min_stay) values($1,$2,$3,$4,'2030-03-01',1900000,'MXN',2)",
    [m.organization_id, m.property_id, m.rate_plan_id, m.inventory_type_id],
  );
  expect(
    Number(
      (
        await db.query<{ total: number }>(
          "select site.cala_quote(1,'2030-03-01','2030-03-03') as total",
        )
      ).rows[0].total,
    ),
  ).toBe(3400000);
  await expect(
    db.exec("select site.cala_quote(1,'2030-03-01','2030-03-02')"),
  ).rejects.toThrow();
  await db.exec(
    "update public.rate_day set closed=true where stay_date='2030-03-01'",
  );
  await expect(
    db.exec("select site.cala_quote(1,'2030-03-01','2030-03-03')"),
  ).rejects.toThrow();
});
test("a paid checkout is recorded exactly once and a conflicting late payment stays draft for review", async () => {
  const id = await booking(
    "2030-04-01",
    "2030-04-03",
    "PENDING",
    "cs_test_first",
  );
  for (let n = 0; n < 2; n++)
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select site.accept_stripe_payment($1,$2,$3,$4,$5) as ok",
          [id, "evt_test_first", "cs_test_first", 3000000, "MXN"],
        )
      ).rows[0].ok,
    ).toBe(true);
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int as n from public.payments where provider_payment_id='cs_test_first'",
      )
    ).rows[0].n,
  ).toBe(1);
  const late = await booking(
    "2030-05-01",
    "2030-05-03",
    "EXPIRED",
    "cs_test_late",
  );
  await booking("2030-05-01", "2030-05-03", "CONFIRMED");
  expect(
    (
      await db.query<{ ok: boolean }>(
        "select site.accept_stripe_payment($1,$2,$3,$4,$5) as ok",
        [late, "evt_test_late", "cs_test_late", 3000000, "MXN"],
      )
    ).rows[0].ok,
  ).toBe(false);
  expect(
    (
      await db.query<{ status: string }>(
        `select r.status from public.reservations r join pms_private.site_booking_map m on m.reservation_id=r.id where m.site_booking_id=$1`,
        [late],
      )
    ).rows[0].status,
  ).toBe("draft");
  expect(
    (
      await db.query(
        "select * from site.integration_alerts where booking_id=$1",
        [late],
      )
    ).rows,
  ).toHaveLength(1);
  await expect(
    db.query("select site.accept_stripe_payment($1,$2,$3,$4,$5)", [
      late,
      "evt_bad",
      "cs_wrong",
      3000000,
      "MXN",
    ]),
  ).rejects.toThrow();
});
test("manual blocks convert inclusively in both directions and release without stale availability", async () => {
  const sid = (
    await db.query<{ id: number }>(
      "insert into site.blocked_dates(property_id,start_date,end_date,reason,updated_at) values(1,'2030-06-01','2030-06-02','Prueba',now()) returning id",
    )
  ).rows[0].id;
  expect(
    (
      await db.query<{ end: string }>(
        "select b.end_date::text as end from public.inventory_blocks b join pms_private.site_block_map m on b.id=m.block_id where m.site_block_id=$1",
        [sid],
      )
    ).rows[0].end,
  ).toBe("2030-06-03");
  await db.query("delete from site.blocked_dates where id=$1", [sid]);
  const m = (
    await db.query<{
      organization_id: string;
      property_id: string;
      unit_id: string;
    }>("select * from pms_private.site_property_map where site_property_id=1")
  ).rows[0];
  const bid = (
    await db.query<{ id: string }>(
      "insert into public.inventory_blocks(organization_id,property_id,unit_id,start_date,end_date,reason) values($1,$2,$3,'2030-06-10','2030-06-12','CALA') returning id",
      [m.organization_id, m.property_id, m.unit_id],
    )
  ).rows[0].id;
  expect(
    (
      await db.query<{ end: string }>(
        "select b.end_date::date::text as end from site.blocked_dates b join pms_private.site_block_map m on b.id=m.site_block_id where m.block_id=$1",
        [bid],
      )
    ).rows[0].end,
  ).toBe("2030-06-11");
  await db.query(
    "update public.inventory_blocks set status='released' where id=$1",
    [bid],
  );
  expect(
    (await db.query("select * from site.blocked_dates where reason='CALA'"))
      .rows,
  ).toHaveLength(0);
});
test("the authenticated CALA movement RPC commits its site mirror, rejects stale versions and protects preparation", async () => {
  const id = await booking("2031-01-01", "2031-01-03", "CONFIRMED");
  const row = (
    await db.query<{ id: string; version: number; unit_id: string }>(
      `select r.id,r.version,u.unit_id from public.reservations r join public.reservation_units u on u.reservation_id=r.id join pms_private.site_booking_map m on m.reservation_id=r.id where m.site_booking_id=$1`,
      [id],
    )
  ).rows[0];
  await db.exec(
    `select set_config('request.jwt.claim.sub','${owner}',false);set role authenticated;`,
  );
  const command = {
    type: "reservation.move",
    organizationId: ids.organizationId,
    propertyId: ids.defaultPropertyId,
    id: row.id,
    version: Number(row.version),
    unitId: row.unit_id,
    arrival: "2031-01-05",
    departure: "2031-01-07",
    pricing: "preserve",
  };
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify(command),
    "site-rpc-move-1",
  ]);
  await expect(
    db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify({
        ...command,
        arrival: "2031-01-08",
        departure: "2031-01-10",
      }),
      "site-rpc-stale-2",
    ]),
  ).rejects.toThrow();
  await db.exec("reset role");
  expect(
    (
      await db.query<{ arrival: string }>(
        "select start_date::date::text as arrival from site.reservas where id=$1",
        [id],
      )
    ).rows[0].arrival,
  ).toBe("2031-01-05");
  await expect(
    db.query(
      "update public.inventory_blocks set status='released' where id=(select buffer_id from pms_private.site_booking_map where site_booking_id=$1)",
      [id],
    ),
  ).rejects.toThrow(/CHECKOUT_BUFFER_MANAGED/);
});
test("deleting an unpaid legacy booking cancels inventory while settled history cannot be deleted", async () => {
  const id = await booking("2031-02-01", "2031-02-03");
  const rid = (
    await db.query<{ reservation_id: string }>(
      "select reservation_id from pms_private.site_booking_map where site_booking_id=$1",
      [id],
    )
  ).rows[0].reservation_id;
  await db.query("delete from site.reservas where id=$1", [id]);
  expect(
    (
      await db.query<{ status: string }>(
        "select status from public.reservations where id=$1",
        [rid],
      )
    ).rows[0].status,
  ).toBe("cancelled");
  const paid = await booking("2031-03-01", "2031-03-03", "PENDING", "cs_guard");
  await db.query("select site.accept_stripe_payment($1,$2,$3,$4,$5)", [
    paid,
    "evt_guard",
    "cs_guard",
    3000000,
    "MXN",
  ]);
  await expect(
    db.query("delete from site.reservas where id=$1", [paid]),
  ).rejects.toThrow(/PAID_RESERVATION_CANNOT_DELETE/);
});

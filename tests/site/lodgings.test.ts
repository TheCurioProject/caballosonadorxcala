import { beforeAll, afterAll, test, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
let db: PGlite;
const owner = "b1000000-0000-0000-0000-000000000001";
let scope: { organizationId: string; defaultPropertyId: string };
let products: Array<{
  id: string;
  unit_id: string;
  inventory_type_id: string;
  rate_plan_id: string;
  kind: string;
}>;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`,
  );
  for (const name of readdirSync("supabase/migrations")
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
  await db.query("insert into auth.users values($1,$2)", [
    owner,
    "owner@example.test",
  ]);
  scope = (
    await db.query<{ data: typeof scope }>(
      "select site.bootstrap_cala($1) as data",
      [owner],
    )
  ).rows[0].data;
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
      "insert into site.lodgings(site_property_id,unit_id,inventory_type_id,rate_plan_id,kind,slug,name_es) select site_property_id,$1,$2,rate_plan_id,'room',$3,$4 from pms_private.site_property_map",
      [unit, type, "room-" + i, "Habitación " + i],
    );
  }
  products = (
    await db.query<(typeof products)[number]>(
      "select id,unit_id,inventory_type_id,rate_plan_id,kind from site.lodgings order by kind desc,slug",
    )
  ).rows;
}, 60000);
afterAll(async () => {
  await db?.close();
});
const whole = () => products.find((p) => p.kind === "whole_home")!;
const room = (i = 0) => products.filter((p) => p.kind === "room")[i];
async function quote(
  lodging: string,
  start: string,
  end: string,
  adults = 2,
  children = 0,
) {
  return Number(
    (
      await db.query<{ total: number }>(
        "select site.lodging_quote($1,$2,$3,$4,$5,$6) as total",
        [lodging, start, end, adults, children, scope.organizationId],
      )
    ).rows[0].total,
  );
}
async function booking(
  lodging: string,
  start: string,
  end: string,
  adults = 2,
  children = 0,
  external: string | null = null,
) {
  await db.exec("begin");
  try {
    const id = (
      await db.query<{ id: number }>(
        `insert into site.reservas(property_id,start_date,end_date,"guestName","guestEmail",payment_status,origin,"totalPrice","externalId",updated_at) values(1,$1,$2,'Invitado de prueba','guest@example.test','PENDING','WEBSITE',2000,$3,now()) returning id`,
        [start, end, external],
      )
    ).rows[0].id;
    await db.query("insert into site.booking_lodging values($1,$2,$3,$4)", [
      id,
      lodging,
      adults,
      children,
    ]);
    await db.exec("commit");
    return id;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}
test("a room occupies the whole-house product, while independent rooms remain bookable", async () => {
  const id = await booking(room().id, "2033-01-10", "2033-01-12");
  expect(await quote(room(1).id, "2033-01-10", "2033-01-12")).toBe(200000);
  await expect(quote(whole().id, "2033-01-10", "2033-01-12")).rejects.toThrow();
  await expect(
    booking(room().id, "2033-01-10", "2033-01-12"),
  ).rejects.toThrow();
  expect(
    (
      await db.query<{ adults: number }>(
        "select r.adults from public.reservations r join pms_private.site_booking_map m on m.reservation_id=r.id where m.site_booking_id=$1",
        [id],
      )
    ).rows[0].adults,
  ).toBe(2);
  expect(await quote(room().id, "2033-01-12", "2033-01-14")).toBe(200000);
});
test("whole-house bookings and physical maintenance exclude every child, with half-open checkout dates", async () => {
  await booking(whole().id, "2033-02-01", "2033-02-03", 12);
  for (const p of products)
    await expect(quote(p.id, "2033-02-01", "2033-02-03")).rejects.toThrow();
  expect(await quote(room().id, "2033-02-03", "2033-02-05")).toBe(200000);
  await db.query(
    "insert into public.inventory_blocks(organization_id,property_id,unit_id,start_date,end_date,reason) values($1,$2,$3,'2033-02-10','2033-02-12','Mantenimiento')",
    [scope.organizationId, scope.defaultPropertyId, room().unit_id],
  );
  await expect(quote(room().id, "2033-02-10", "2033-02-12")).rejects.toThrow();
  await expect(quote(whole().id, "2033-02-10", "2033-02-12")).rejects.toThrow();
  expect(await quote(room(1).id, "2033-02-10", "2033-02-12")).toBe(200000);
});
test("legacy commercial closures affect the whole house and preserve room availability", async () => {
  await db.query("select site.save_sales_closure($1::jsonb,$2)", [
    JSON.stringify({
      actorId: owner,
      lodgingId: whole().id,
      startDate: "2033-03-01",
      endDate: "2033-03-03",
      reason: "Solo casa completa",
    }),
    scope.organizationId,
  ]);
  await expect(quote(whole().id, "2033-03-01", "2033-03-03")).rejects.toThrow();
  expect(await quote(room().id, "2033-03-01", "2033-03-03")).toBe(200000);
  const availability = (
    await db.query<{ data: Record<string, unknown> }>(
      "select site.lodging_availability($1,$2) as data",
      [whole().id, scope.organizationId],
    )
  ).rows[0].data;
  expect(JSON.stringify(availability)).not.toMatch(
    /guest@example|Invitado|unit_id|reservation_id/,
  );
  expect(availability.salesClosures).toHaveLength(1);
});
test("payments and calendar moves retain the selected room, occupancy and original amount", async () => {
  const id = await booking(
    room().id,
    "2033-04-01",
    "2033-04-03",
    1,
    1,
    "cs_rooms_fixture",
  );
  const rid = (
    await db.query<{ reservation_id: string }>(
      "select reservation_id from pms_private.site_booking_map where site_booking_id=$1",
      [id],
    )
  ).rows[0].reservation_id;
  await db.exec(
    `select set_config('request.jwt.claim.sub','${owner}',false);set role authenticated;`,
  );
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify({
      type: "reservation.move",
      organizationId: scope.organizationId,
      propertyId: scope.defaultPropertyId,
      id: rid,
      version: 1,
      unitId: room(1).unit_id,
      arrival: "2033-04-05",
      departure: "2033-04-07",
      pricing: "preserve",
    }),
    "lodging-move",
  ]);
  await db.exec("reset role");
  await db.query("select site.accept_stripe_payment($1,$2,$3,$4,$5)", [
    id,
    "evt_rooms_fixture",
    "cs_rooms_fixture",
    200000,
    "MXN",
  ]);
  const row = (
    await db.query<{
      lodging_id: string;
      adults: number;
      children: number;
      total_minor: number;
    }>(
      `select bl.*,r.total_minor from site.booking_lodging bl join pms_private.site_booking_map m on m.site_booking_id=bl.booking_id join public.reservations r on r.id=m.reservation_id where bl.booking_id=$1`,
      [id],
    )
  ).rows[0];
  expect(row.lodging_id).toBe(room(1).id);
  expect(row.adults).toBe(1);
  expect(row.children).toBe(1);
  expect(Number(row.total_minor)).toBe(200000);
  expect(await quote(room().id, "2033-04-05", "2033-04-07")).toBe(200000);
  await expect(quote(room(1).id, "2033-04-05", "2033-04-07")).rejects.toThrow();
});
test("occupancy, minimum stays, foreign organization IDs and direct anonymous access fail closed", async () => {
  await expect(
    quote(room().id, "2033-05-01", "2033-05-03", 3),
  ).rejects.toThrow();
  await expect(quote(room().id, "2033-05-01", "2033-05-02")).rejects.toThrow();
  await expect(
    db.query("select site.lodging_availability($1,$2)", [
      room().id,
      "b1000000-0000-0000-0000-000000000099",
    ]),
  ).rejects.toThrow();
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    await expect(
      db.query("select site.lodging_catalog(false,$1)", [scope.organizationId]),
    ).rejects.toThrow();
    await expect(db.exec("select * from site.lodgings")).rejects.toThrow();
    await db.exec("reset role");
  }
});
test("website editing uses optimistic versions, records the editor and preserves existing booking terms", async () => {
  const lodging = (
    await db.query<{ data: Array<Record<string, unknown>> }>(
      "select site.lodging_catalog(true,$1) as data",
      [scope.organizationId],
    )
  ).rows[0].data.find((l) => l.id === room().id)!;
  const payload = {
    ...lodging,
    actorId: owner,
    name: { es: "Nombre editado", en: "Edited name" },
    baseRateMinor: 125000,
    turnoverNights: 1,
  };
  await db.query("select site.save_lodging($1,$2,$3::jsonb,$4)", [
    room().id,
    lodging.version,
    JSON.stringify(payload),
    scope.organizationId,
  ]);
  const catalog = (
    await db.query<{ data: Array<Record<string, unknown>> }>(
      "select site.lodging_catalog(false,$1) as data",
      [scope.organizationId],
    )
  ).rows[0].data;
  expect(catalog.find((l) => l.id === room().id)?.name).toEqual({
    es: "Nombre editado",
    en: "Edited name",
  });
  await expect(
    db.query("select site.save_lodging($1,$2,$3::jsonb,$4)", [
      room().id,
      lodging.version,
      JSON.stringify(payload),
      scope.organizationId,
    ]),
  ).rejects.toThrow(/VERSION_CONFLICT/);
  const audit = (
    await db.query<{ actor_id: string }>(
      "select actor_id from public.audit_logs where action='site.lodging.save' order by created_at desc limit 1",
    )
  ).rows[0];
  expect(audit.actor_id).toBe(owner);
  const terms = (
    await db.query<{ turnover_nights: number }>(
      "select turnover_nights from site.booking_lodging where lodging_id=$1",
      [room().id],
    )
  ).rows;
  expect(terms.every((t) => t.turnover_nights === 0)).toBe(true);
});
test("CALA rates & restrictions for Casa Caballo Soñador reach the website; other properties never do", async () => {
  const r = room(1);
  const rate = (
    date: string,
    amount: number,
    extra: Partial<{ min_stay: number; closed: boolean; cta: boolean; ctd: boolean }> = {},
  ) =>
    db.query(
      "insert into public.rate_day(organization_id,property_id,rate_plan_id,inventory_type_id,stay_date,amount_minor,currency,min_stay,closed,cta,ctd) values($1,$2,$3,$4,$5,$6,'MXN',$7,$8,$9,$10) on conflict(rate_plan_id,inventory_type_id,stay_date,occupancy_key) do update set amount_minor=excluded.amount_minor,min_stay=excluded.min_stay,closed=excluded.closed,cta=excluded.cta,ctd=excluded.ctd",
      [scope.organizationId, scope.defaultPropertyId, r.rate_plan_id, r.inventory_type_id, date, amount,
        extra.min_stay ?? 1, extra.closed ?? false, extra.cta ?? false, extra.ctd ?? false],
    );
  // Price edited in the rates grid is quoted as-is; a restriction-only row
  // (no price) falls back to the base rate instead of selling for 0.
  await rate("2034-01-10", 150000);
  await rate("2034-01-11", 0);
  expect(await quote(r.id, "2034-01-10", "2034-01-12")).toBe(250000);
  // Closed to arrival / departure and per-night minimum stay.
  await rate("2034-01-20", 100000, { cta: true });
  await expect(quote(r.id, "2034-01-20", "2034-01-22")).rejects.toThrow(/RATE_RESTRICTION/);
  await rate("2034-01-27", 100000, { ctd: true });
  await expect(quote(r.id, "2034-01-25", "2034-01-27")).rejects.toThrow(/DEPARTURE_CLOSED/);
  await rate("2034-01-15", 100000, { min_stay: 4 });
  await expect(quote(r.id, "2034-01-15", "2034-01-17")).rejects.toThrow(/RATE_RESTRICTION/);
  expect(await quote(r.id, "2034-01-15", "2034-01-19")).toBe(400000);
  const availability = (
    await db.query<{ data: { pricingRules: Array<Record<string, unknown>> } }>(
      "select site.lodging_availability($1,$2) as data",
      [r.id, scope.organizationId],
    )
  ).rows[0].data;
  const byDate = Object.fromEntries(availability.pricingRules.map((x) => [x.date, x]));
  expect(byDate["2034-01-10"]).toMatchObject({ priceOverride: 1500, closed: false });
  expect(byDate["2034-01-11"]).toMatchObject({ priceOverride: 1000 });
  expect(byDate["2034-01-20"]).toMatchObject({ cta: true, ctd: false });
  expect(byDate["2034-01-27"]).toMatchObject({ ctd: true });
  expect(byDate["2034-01-15"]).toMatchObject({ minStay: 4, maxStay: 730 });
  // A second CALA property in the same organization: its rates never leak
  // into the website catalog, availability or quotes.
  const other = (
    await db.query<{ id: string }>(
      "insert into public.properties(organization_id,name,concept) values($1,'Otra propiedad','hotel') returning id",
      [scope.organizationId],
    )
  ).rows[0].id;
  await db.query("insert into public.property_settings(property_id,organization_id) values($1,$2)", [other, scope.organizationId]);
  const otherType = (
    await db.query<{ id: string }>(
      "insert into public.inventory_types(organization_id,property_id,name,sell_mode,max_occupancy,base_rate_minor) values($1,$2,'Suite','unit',2,1) returning id",
      [scope.organizationId, other],
    )
  ).rows[0].id;
  const otherPlan = (
    await db.query<{ id: string }>(
      "insert into public.rate_plans(organization_id,property_id,name) values($1,$2,'Otra') returning id",
      [scope.organizationId, other],
    )
  ).rows[0].id;
  await db.query(
    "insert into public.rate_day(organization_id,property_id,rate_plan_id,inventory_type_id,stay_date,amount_minor,currency,closed) values($1,$2,$3,$4,'2034-01-10',1,'MXN',true)",
    [scope.organizationId, other, otherPlan, otherType],
  );
  expect(await quote(r.id, "2034-01-10", "2034-01-12")).toBe(250000);
  const catalog = (
    await db.query<{ data: Array<{ id: string }> }>("select site.lodging_catalog(false,$1) as data", [scope.organizationId])
  ).rows[0].data;
  expect(catalog.map((l) => l.id).sort()).toEqual(products.map((p) => p.id).sort());
});
test("one Stripe checkout pays several rooms, each with its own CALA reservation", async () => {
  await db.exec("begin");
  const ids: number[] = [];
  for (const [i, total] of [[0, 2000], [1, 3000]] as const) {
    const id = (
      await db.query<{ id: number }>(
        `insert into site.reservas(property_id,start_date,end_date,"guestName","guestEmail",payment_status,origin,"totalPrice","externalId",updated_at) values(1,'2033-06-01','2033-06-03','Grupo de prueba','group@example.test','PENDING','WEBSITE',$1,$2,now()) returning id`,
        [total, i === 0 ? "cs_group" : "cs_group#pending"],
      )
    ).rows[0].id;
    await db.query("insert into site.booking_lodging values($1,$2,$3,$4)", [id, room(i).id, 2, 0]);
    if (i > 0) await db.query(`update site.reservas set "externalId"='cs_group#'||id where id=$1`, [id]);
    ids.push(id);
  }
  await db.exec("commit");
  await expect(quote(whole().id, "2033-06-01", "2033-06-03")).rejects.toThrow();
  // A 10% promotion: 4,500 paid for 5,000 booked, split 1,800 / 2,700.
  for (let attempt = 0; attempt < 2; attempt++)
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select site.accept_stripe_group_payment($1,$2,$3,$4,$5) as ok",
          [ids, "evt_group", "cs_group", 450000, "MXN"],
        )
      ).rows[0].ok,
    ).toBe(true);
  const rows = (
    await db.query<{ status: string; unit_id: string; amount: number; total: number }>(
      `select r.status,ru.unit_id,p.amount_minor as amount,r.total_minor as total from pms_private.site_booking_map m join public.reservations r on r.id=m.reservation_id join public.reservation_units ru on ru.reservation_id=r.id join public.payments p on p.reservation_id=r.id where m.site_booking_id=any($1) order by m.site_booking_id`,
      [ids],
    )
  ).rows;
  expect(rows.map((r) => r.status)).toEqual(["confirmed", "confirmed"]);
  expect(rows.map((r) => r.unit_id)).toEqual([room(0).unit_id, room(1).unit_id]);
  expect(rows.map((r) => Number(r.amount))).toEqual([180000, 270000]);
  await expect(
    db.query("select site.accept_stripe_group_payment($1,$2,$3,$4,$5)", [ids, "evt_bad", "cs_other", 450000, "MXN"]),
  ).rejects.toThrow(/PAYMENT_MISMATCH/);
});

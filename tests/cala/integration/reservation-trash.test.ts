import { beforeAll, afterAll, test, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

// Papelera de reservas: borrar cancela y libera fechas (CALA y web) durante 10
// días, recuperar devuelve el estado anterior si sigue habiendo sitio y,
// pasado el plazo (o con "Borrar ya"), la estancia desaparece por completo.
let db: PGlite;
const owner = "b0000000-0000-0000-0000-000000000001";
const desk = "b0000000-0000-0000-0000-000000000002";
const house = "b0000000-0000-0000-0000-000000000003";
const guest = "b0000000-0000-0000-0000-0000000000a1";
let org = "";
let prop = "";
let type = "";
let unit = "";
let plan = "";
let key = 0;

async function root() {
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);`);
}
async function as(user: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`,
  );
}
async function command(user: string, c: Record<string, unknown>) {
  await as(user);
  try {
    const r = await db.query<{ r: { id: string; message: string } }>(
      "select public.pms_command($1::jsonb,$2) r",
      [JSON.stringify({ organizationId: org, propertyId: prop, ...c }), `trash-test-${++key}`],
    );
    return r.rows[0].r;
  } finally {
    await root();
  }
}
async function one<T>(sql: string, params: unknown[] = []) {
  await root();
  return (await db.query<T>(sql, params)).rows[0];
}
async function stay(arrival: string, departure: string) {
  const r = await command(owner, {
    type: "reservation.save",
    guestId: guest,
    inventoryTypeId: type,
    unitId: unit,
    ratePlanId: plan,
    arrival,
    departure,
    adults: 2,
    children: 0,
    notes: "",
    status: "confirmed",
  });
  return r.id;
}
const reservation = (id: string) =>
  one<{ status: string; version: number }>(
    "select status,version::int from public.reservations where id=$1",
    [id],
  );
const website = (id: string) =>
  one<{ id: number; payment_status: string } | undefined>(
    "select b.id,b.payment_status from site.reservas b join pms_private.site_booking_map m on m.site_booking_id=b.id where m.reservation_id=$1",
    [id],
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid(),auth.jwt() to authenticated,service_role;grant usage on schema public to service_role;`,
  );
  for (const name of readdirSync("supabase/migrations").filter((x) => x.endsWith(".sql")).sort())
    await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
  await db.query(
    "insert into auth.users(id,email) values($1,'owner@example.test'),($2,'desk@example.test'),($3,'house@example.test')",
    [owner, desk, house],
  );
  const ids = (
    await db.query<{ data: { organizationId: string; defaultPropertyId: string } }>(
      "select site.bootstrap_cala($1::uuid) as data",
      [owner],
    )
  ).rows[0].data;
  org = ids.organizationId;
  prop = ids.defaultPropertyId;
  const m = await one<{ inventory_type_id: string; unit_id: string; rate_plan_id: string }>(
    "select inventory_type_id,unit_id,rate_plan_id from pms_private.site_property_map where property_id=$1",
    [prop],
  );
  type = m.inventory_type_id;
  unit = m.unit_id;
  plan = m.rate_plan_id;
  await db.query(
    `insert into public.organization_members(organization_id,user_id,role_id,all_properties)
     values($1,$2,(select id from public.roles where key='front_desk' and organization_id is null),true),
           ($1,$3,(select id from public.roles where key='housekeeping' and organization_id is null),true)`,
    [org, desk, house],
  );
  await db.query(
    "insert into public.guests(id,organization_id,first_name,last_name) values($1,$2,'Ana','Papelera')",
    [guest, org],
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});

test("deleting frees the dates quietly, keeps the stay hidden in the trash and blocks edits", async () => {
  const id = await stay("2033-01-10", "2033-01-12");
  const before = await one<{ n: number }>("select count(*)::int n from public.notifications");
  const r = await reservation(id);
  await expect(command(house, { type: "reservation.delete", id, version: r.version })).rejects.toThrow();
  expect((await command(owner, { type: "reservation.delete", id, version: r.version })).message).toMatch(/papelera/);
  expect((await reservation(id)).status).toBe("cancelled");
  expect((await website(id))?.payment_status).toBe("CANCELLED");
  const trash = await one<{ previous_status: string; days: number }>(
    "select previous_status,round(extract(epoch from purge_after-deleted_at)/86400)::int days from public.reservation_trash where reservation_id=$1",
    [id],
  );
  expect(trash).toEqual({ previous_status: "confirmed", days: 10 });
  // Nobody is told the stay was "cancelled".
  expect((await one<{ n: number }>("select count(*)::int n from public.notifications")).n).toBe(before.n);
  // Everyone who reads reservations sees the trash (so the calendar can hide it); RLS keeps other tenants out.
  await as(desk);
  expect((await db.query("select * from public.reservation_trash")).rows).toHaveLength(1);
  await root();
  const v = (await reservation(id)).version;
  await expect(
    command(owner, { type: "reservation.transition", id, status: "confirmed", version: v }),
  ).rejects.toThrow(/RESERVATION_IN_TRASH/);
  await expect(command(owner, { type: "reservation.delete", id })).rejects.toThrow(/ALREADY_IN_TRASH/);
  // The dates are free again: another stay fits.
  const other = await stay("2033-01-10", "2033-01-12");
  // …so recovering the first one is refused while the second one exists.
  await expect(command(owner, { type: "reservation.restore", id })).rejects.toThrow(/UNIT_CONFLICT|NO_AVAILABILITY/);
  expect((await one<{ n: number }>("select count(*)::int n from public.reservation_trash where reservation_id=$1", [id])).n).toBe(1);
  await command(owner, { type: "reservation.delete", id: other });
  expect((await command(owner, { type: "reservation.restore", id })).message).toBe("Reserva recuperada.");
  expect((await reservation(id)).status).toBe("confirmed");
  expect((await website(id))?.payment_status).toBe("CONFIRMED");
  expect((await one<{ n: number }>("select count(*)::int n from public.reservation_trash where reservation_id=$1", [id])).n).toBe(0);
});

test("a paid website booking comes back paid, and purging removes it everywhere", async () => {
  await root();
  const site = (
    await db.query<{ id: number }>(
      `insert into site.reservas(property_id,start_date,end_date,"guestName","guestEmail","guestPhone",payment_status,origin,"totalPrice","externalId",updated_at) values(1,'2033-03-01','2033-03-03','Web','web@example.test','3312345678','PENDING','WEBSITE',30000,'cs_trash',now()) returning id`,
    )
  ).rows[0].id;
  await db.query("select site.accept_stripe_payment($1,$2,$3,$4,$5)", [site, "evt_trash", "cs_trash", 3000000, "MXN"]);
  const id = (await one<{ reservation_id: string }>("select reservation_id from pms_private.site_booking_map where site_booking_id=$1", [site])).reservation_id;
  await command(desk, { type: "reservation.delete", id });
  expect((await website(id))?.payment_status).toBe("CANCELLED");
  await command(desk, { type: "reservation.restore", id });
  expect((await reservation(id)).status).toBe("confirmed");
  expect((await website(id))?.payment_status).toBe("PAID");
  await command(desk, { type: "reservation.delete", id });
  await expect(command(desk, { type: "reservation.purge", id: guest })).rejects.toThrow(/NOT_FOUND/);
  // Day 10 passes: the cron empties it.
  await db.query("update public.reservation_trash set purge_after=now()-interval '1 minute' where reservation_id=$1", [id]);
  await db.exec("set role service_role");
  expect((await db.query<{ n: number }>("select public.pms_service_purge_reservation_trash(50) n")).rows[0].n).toBe(1);
  await root();
  for (const [table, column] of [
    ["public.reservations", "id"],
    ["public.reservation_units", "reservation_id"],
    ["public.folios", "reservation_id"],
    ["public.payments", "reservation_id"],
    ["public.reservation_trash", "reservation_id"],
    ["pms_private.site_booking_map", "reservation_id"],
  ])
    expect((await one<{ n: number }>(`select count(*)::int n from ${table} where ${column}=$1`, [id])).n).toBe(0);
  expect((await one<{ n: number }>("select count(*)::int n from site.reservas where id=$1", [site])).n).toBe(0);
  expect((await one<{ n: number }>("select count(*)::int n from public.audit_logs where entity_id=$1 and action='reservation.purge'", [id])).n).toBe(1);
  // The dates are sellable again.
  await stay("2033-03-01", "2033-03-03");
});

test("'Borrar ya' deletes only stays already in the trash; revived stays leave the trash", async () => {
  const id = await stay("2033-05-01", "2033-05-03");
  await expect(command(owner, { type: "reservation.purge", id })).rejects.toThrow(/NOT_IN_TRASH/);
  await command(owner, { type: "reservation.delete", id });
  await command(owner, { type: "reservation.purge", id });
  expect(await one("select id from public.reservations where id=$1", [id])).toBeUndefined();
  // A trashed website checkout the guest pays anyway is revived and leaves the trash.
  await root();
  const site = (
    await db.query<{ id: number }>(
      `insert into site.reservas(property_id,start_date,end_date,"guestName","guestEmail","guestPhone",payment_status,origin,"totalPrice","externalId",updated_at) values(1,'2033-06-01','2033-06-03','Late','late@example.test','3312345678','PENDING','WEBSITE',30000,'cs_late_trash',now()) returning id`,
    )
  ).rows[0].id;
  const rid = (await one<{ reservation_id: string }>("select reservation_id from pms_private.site_booking_map where site_booking_id=$1", [site])).reservation_id;
  await command(owner, { type: "reservation.delete", id: rid });
  await root();
  await db.query("select site.accept_stripe_payment($1,$2,$3,$4,$5)", [site, "evt_late_trash", "cs_late_trash", 3000000, "MXN"]);
  expect((await reservation(rid)).status).toBe("confirmed");
  await db.exec("set role service_role");
  await db.query("select public.pms_service_purge_reservation_trash(50)");
  await root();
  expect((await one<{ n: number }>("select count(*)::int n from public.reservation_trash where reservation_id=$1", [rid])).n).toBe(0);
  expect((await reservation(rid)).status).toBe("confirmed");
});

test("workspace stamp changes with the data, stays put otherwise and needs a member", async () => {
  const stamp = async (user: string) => {
    await as(user);
    try {
      return (await db.query<{ s: string }>("select public.pms_workspace_stamp($1) s", [org])).rows[0].s;
    } finally {
      await root();
    }
  };
  const first = await stamp(owner);
  expect(first).toMatch(/^[a-f0-9]{32}$/);
  expect(await stamp(desk)).toBe(first);
  expect(await stamp(owner)).toBe(first);
  const id = await stay("2033-08-01", "2033-08-03");
  const second = await stamp(owner);
  expect(second).not.toBe(first);
  await command(owner, { type: "reservation.delete", id });
  expect(await stamp(owner)).not.toBe(second);
  await expect(stamp("b0000000-0000-0000-0000-0000000000ff")).rejects.toThrow(/FORBIDDEN/);
});

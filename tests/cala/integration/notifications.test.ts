import { beforeAll, afterAll, test, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

// Notifications reach only the roles allowed to manage each thing, automation
// rules really run, and a task closes with one tap by whoever it belongs to.
let db: PGlite;
const ids = {
  org: "10000000-0000-0000-0000-000000000001",
  owner: "20000000-0000-0000-0000-000000000001",
  house: "20000000-0000-0000-0000-000000000002",
  desk: "20000000-0000-0000-0000-000000000003",
  house2: "20000000-0000-0000-0000-000000000004",
  finance: "20000000-0000-0000-0000-000000000005",
  prop: "30000000-0000-0000-0000-000000000001",
  type: "40000000-0000-0000-0000-000000000001",
  unit: "50000000-0000-0000-0000-000000000001",
  guest: "60000000-0000-0000-0000-000000000001",
  res: "70000000-0000-0000-0000-000000000001",
  res2: "70000000-0000-0000-0000-000000000002",
};
/** Direct table access (fixtures and checks) as the database owner, optionally on behalf of a user. */
async function owner(actor = "") {
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','${actor}',false);`);
}
async function as(user: string | null) {
  await db.exec(
    user
      ? `reset role;select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`
      : `reset role;select set_config('request.jwt.claim.sub','',false);set role service_role;`,
  );
}
let key = 0;
async function command(c: Record<string, unknown>) {
  const r = await db.query<{ r: Record<string, unknown> }>(
    "select public.pms_command($1::jsonb,$2) r",
    [JSON.stringify({ organizationId: ids.org, propertyId: ids.prop, ...c }), `notify-${++key}`],
  );
  return r.rows[0].r;
}
async function bell(user: string, action = "list", extra: Record<string, unknown> = {}) {
  await as(user);
  const r = await db.query<{ r: { items: { kind: string; title: string; body: string; url: string }[]; unread: number } }>(
    "select public.pms_notifications($1::jsonb) r",
    [JSON.stringify({ action, organizationId: ids.org, ...extra })],
  );
  return r.rows[0].r;
}
async function reservation(id: string) {
  const r = await db.query<{ status: string; version: number }>(
    "select status,version from public.reservations where id=$1",
    [id],
  );
  return r.rows[0];
}
async function transition(id: string, status: string) {
  const r = await reservation(id);
  return db.query("select public.pms_transition_reservation($1::jsonb,$2)", [
    JSON.stringify({ organizationId: ids.org, propertyId: ids.prop, id, status, version: Number(r.version) }),
    `transition-${++key}`,
  ]);
}
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
  for (const name of readdirSync("supabase/migrations").filter((x) => x.endsWith(".sql")).sort())
    await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
  const member = (user: string, role: string) =>
    `('${ids.org}','${user}',(select id from public.roles where key='${role}' and organization_id is null),true)`;
  await db.exec(
    `insert into auth.users values('${ids.owner}','owner@example.com','{"name":"Cortni"}'),('${ids.house}','house@example.com','{"name":"Lupita"}'),('${ids.desk}','desk@example.com','{}'),('${ids.house2}','house2@example.com','{}'),('${ids.finance}','money@example.com','{}');` +
      `insert into public.organizations(id,name) values('${ids.org}','Tenant A');` +
      `insert into public.organization_members(organization_id,user_id,role_id,all_properties) values${[
        member(ids.owner, "owner"),
        member(ids.house, "housekeeping"),
        member(ids.desk, "front_desk"),
        member(ids.house2, "housekeeping"),
        member(ids.finance, "finance"),
      ].join(",")};` +
      `insert into public.properties(id,organization_id,name,concept) values('${ids.prop}','${ids.org}','Hotel A','hotel');insert into public.property_settings(organization_id,property_id) values('${ids.org}','${ids.prop}');` +
      `insert into public.inventory_types(id,organization_id,property_id,name,sell_mode,max_occupancy,base_rate_minor) values('${ids.type}','${ids.org}','${ids.prop}','Suite','unit',2,100000);` +
      `insert into public.units(id,organization_id,property_id,inventory_type_id,name) values('${ids.unit}','${ids.org}','${ids.prop}','${ids.type}','Room 3');` +
      `insert into public.rate_plans(organization_id,property_id,name) values('${ids.org}','${ids.prop}','Base');` +
      `insert into public.guests(id,organization_id,first_name,last_name,email) values('${ids.guest}','${ids.org}','Ana','López','ana@example.com');`,
  );
}, 120000);
afterAll(async () => {
  await db?.close();
});

const stay = (id: string, code: string, a: number, d: number) =>
  `insert into public.reservations(id,organization_id,property_id,guest_id,confirmation_code,arrival_date,departure_date,adults,status,currency,total_minor) values('${id}','${ids.org}','${ids.prop}','${ids.guest}','${code}','${day(a)}','${day(d)}',2,'confirmed','MXN',0);` +
  `insert into public.reservation_units(organization_id,property_id,reservation_id,inventory_type_id,unit_id,rate_plan_id,arrival_date,departure_date,guests_count) values('${ids.org}','${ids.prop}','${id}','${ids.type}','${ids.unit}',(select id from public.rate_plans where property_id='${ids.prop}' limit 1),'${day(a)}','${day(d)}',2);`;

test("a rule alerts the roles it names; the bell is separated by role", async () => {
  await as(ids.owner);
  await command({
    type: "automation.save",
    name: "Limpiar tras check-out",
    trigger: "checkout.completed",
    action: "create_task",
    enabled: true,
    notifyRoles: ["housekeeping"],
    onlyIfPending: true,
    taskTitle: "Limpieza de salida",
    taskKind: "housekeeping",
    assigneeId: ids.house,
  });
  await expect(
    command({ type: "automation.save", name: "x", trigger: "checkout.completed", action: "create_task", enabled: true, notifyRoles: ["root"] }),
  ).rejects.toThrow(/INVALID_ROLE/);

  // A stay booked by the owner: front desk hears about it with the guest's name; housekeeping and finance don't.
  await owner(ids.owner);
  await db.exec(stay(ids.res, "WEB-1", -2, 0));
  expect((await bell(ids.owner)).items).toHaveLength(0); // the owner was not the actor here, but the insert ran as owner
  const desk = await bell(ids.desk);
  expect(desk.items.map((n) => n.kind)).toEqual(["reservation.created"]);
  expect(desk.items[0].body).toContain("Ana López");
  expect((await bell(ids.house)).items).toHaveLength(0);
  expect((await bell(ids.finance)).items).toHaveLength(0);

  // Front desk checks the guest in and out: the rule creates the cleaning task assigned to Lupita.
  await as(ids.desk);
  await transition(ids.res, "checked_in");
  await transition(ids.res, "checked_out");
  await owner();
  const tasks = await db.query<{ title: string; assignee_id: string; status: string }>(
    "select title,assignee_id,status from public.tasks",
  );
  expect(tasks.rows).toEqual([{ title: "Limpieza de salida · Room 3", assignee_id: ids.house, status: "pending" }]);

  const house = await bell(ids.house);
  expect(house.items.map((n) => n.kind).sort()).toEqual(["automation", "task.assigned"]);
  const alert = house.items.find((n) => n.kind === "automation")!;
  expect(alert.title).toBe("Limpiar tras check-out");
  expect(alert.body).toContain("1 por hacer: Limpieza de salida · Room 3");
  expect(alert.body).not.toContain("Ana"); // housekeeping never sees guest data
  expect(alert.url).toBe("/admin/limpieza/");
  // The other housekeeper gets the rule's alert, not the personal assignment.
  expect((await bell(ids.house2)).items.map((n) => n.kind)).toEqual(["automation"]);
  // Nobody hears about their own action, and check-out is not a front-desk notice by itself.
  expect((await bell(ids.desk)).items.map((n) => n.kind)).toEqual(["reservation.created"]);
  expect((await bell(ids.owner)).items.map((n) => n.kind)).toEqual(["checkin.completed"]);
});

test("one tap closes a task for its owner only; the leads are told", async () => {
  await owner();
  const task = (await db.query<{ id: string }>("select id from public.tasks limit 1")).rows[0].id;
  // Another housekeeper cannot close Lupita's task.
  await as(ids.house2);
  await expect(command({ type: "task.complete", id: task })).rejects.toThrow(/TASK_NOT_YOURS/);
  // Finance has no operations rights at all.
  await as(ids.finance);
  await expect(command({ type: "task.complete", id: task })).rejects.toThrow(/FORBIDDEN|42501|permission/i);

  await as(ids.house);
  await command({ type: "task.complete", id: task, status: "completed" });
  await owner();
  const done = await db.query<{ status: string; housekeeping_status: string }>(
    `select t.status,u.housekeeping_status from public.tasks t join public.units u on u.id=t.unit_id where t.id='${task}'`,
  );
  expect(done.rows[0]).toEqual({ status: "completed", housekeeping_status: "clean" });
  const leads = await bell(ids.owner);
  const notice = leads.items.find((n) => n.kind === "task.completed")!;
  expect(notice.body).toBe("Limpieza de salida · Room 3 · por Lupita");
  // Housekeeping and front desk are not leads: they are not told.
  expect((await bell(ids.house2)).items.some((n) => n.kind === "task.completed")).toBe(false);
  expect((await bell(ids.desk)).items.some((n) => n.kind === "task.completed")).toBe(false);

  // The owner may close anyone's task.
  await as(ids.owner);
  await command({ type: "task.complete", id: task, status: "pending" });
});

test("rules that only alert when work is pending stay quiet otherwise; expired web checkouts are silent", async () => {
  await owner();
  await db.exec("update public.tasks set status='completed'");
  await db.exec("delete from public.notifications");
  await as(ids.owner);
  await command({
    type: "automation.save",
    name: "Aviso de salida",
    trigger: "checkout.completed",
    action: "notify_team",
    enabled: true,
    notifyRoles: ["front_desk"],
    onlyIfPending: true,
  });
  await owner(ids.owner);
  await db.exec(stay(ids.res2, "WEB-2", 0, 2));
  await db.exec("update public.automation_rules set enabled=false where name='Limpiar tras check-out'");
  await as(ids.owner);
  await transition(ids.res2, "checked_in");
  await transition(ids.res2, "checked_out");
  expect((await bell(ids.desk)).items.map((n) => n.kind)).toEqual(["checkin.completed", "reservation.created"]);

  // A website checkout that expires unpaid is not announced as a cancellation.
  await owner();
  await db.exec("delete from public.notifications");
  await db.exec(
    `insert into public.reservations(id,organization_id,property_id,guest_id,confirmation_code,arrival_date,departure_date,adults,status,source,currency,total_minor) values('70000000-0000-0000-0000-000000000009','${ids.org}','${ids.prop}','${ids.guest}','WEB-9','${day(20)}','${day(22)}',2,'pending','website','MXN',0)`,
  );
  await db.exec("update public.reservations set status='cancelled' where id='70000000-0000-0000-0000-000000000009'");
  expect((await db.query("select 1 from public.notifications")).rows).toHaveLength(0);
});

test("the bell marks read, devices subscribe, and the server claims each push once", async () => {
  await owner();
  await db.exec("delete from public.notifications");
  await bell(ids.owner, "subscribe", { endpoint: "https://push.example.com/abc", p256dh: "B".repeat(40), auth: "a".repeat(16), userAgent: "test" });
  await bell(ids.owner, "test");
  const before = await bell(ids.owner);
  expect(before.unread).toBe(1);
  await as(null);
  const claimed = await db.query<{ r: { title: string; subscriptions: { endpoint: string }[] }[] }>(
    "select public.pms_service_push_claim(10) r",
  );
  expect(claimed.rows[0].r).toHaveLength(1);
  expect(claimed.rows[0].r[0].subscriptions[0].endpoint).toBe("https://push.example.com/abc");
  expect((await db.query<{ r: unknown[] }>("select public.pms_service_push_claim(10) r")).rows[0].r).toHaveLength(0);
  await db.query("select public.pms_service_push_report('{}'::text[],array['https://push.example.com/abc'])");
  await owner();
  expect((await db.query("select 1 from public.push_subscriptions")).rows).toHaveLength(0);
  await bell(ids.owner, "read");
  expect((await bell(ids.owner)).unread).toBe(0);
  // Another user cannot read the owner's notifications.
  expect((await bell(ids.desk)).items.some((n) => n.kind === "test")).toBe(false);
});

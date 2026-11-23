import { beforeAll, afterAll, test, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

let db: PGlite;
const ids = {
  org: "10000000-0000-0000-0000-000000000001",
  user: "20000000-0000-0000-0000-000000000001",
  house: "20000000-0000-0000-0000-000000000002",
  prop: "30000000-0000-0000-0000-000000000001",
  type: "40000000-0000-0000-0000-000000000001",
  unit: "50000000-0000-0000-0000-000000000001",
  guestEs: "60000000-0000-0000-0000-000000000001",
  guestEn: "60000000-0000-0000-0000-000000000002",
  guestNoMail: "60000000-0000-0000-0000-000000000003",
  resNow: "70000000-0000-0000-0000-000000000001",
  resLater: "70000000-0000-0000-0000-000000000002",
  resEn: "70000000-0000-0000-0000-000000000003",
  resNoMail: "70000000-0000-0000-0000-000000000004",
  resCancelled: "70000000-0000-0000-0000-000000000005",
};
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
    [
      JSON.stringify({ organizationId: ids.org, propertyId: ids.prop, ...c }),
      `guest-mail-${++key}`,
    ],
  );
  return r.rows[0].r;
}
async function guestMail(c: Record<string, unknown>) {
  const r = await db.query<{ r: Record<string, unknown> }>(
    "select public.pms_guest_mail($1::jsonb) r",
    [JSON.stringify({ organizationId: ids.org, propertyId: ids.prop, ...c })],
  );
  return r.rows[0].r as Record<string, any>;
}
async function claim() {
  const r = await db.query<{ r: Record<string, any>[] }>(
    "select public.pms_service_guest_mail_claim(20) r",
  );
  return r.rows[0].r;
}
const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const template = {
  type: "template.save",
  name: "Llegada",
  locale: "es",
  subject: "Tu llegada, {{guest_first_name}}",
  body: "Hola {{guest_first_name}}, te esperamos el {{arrival}} ({{nights}} noches, {{guest_count}} huéspedes).",
  trigger: "arrival",
  offsetDays: -2,
  autoSend: true,
  sendTime: "10:00",
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid(),auth.jwt() to authenticated,service_role;grant usage on schema public to service_role;`,
  );
  for (const name of readdirSync("supabase/migrations")
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
  const res = (id: string, guest: string, code: string, a: number, d: number, status = "confirmed") =>
    `insert into public.reservations(id,organization_id,property_id,guest_id,confirmation_code,arrival_date,departure_date,adults,status,currency,total_minor) values('${id}','${ids.org}','${ids.prop}','${guest}','${code}','${day(a)}','${day(d)}',2,'${status}','MXN',0);` +
    `insert into public.reservation_units(organization_id,property_id,reservation_id,inventory_type_id,unit_id,rate_plan_id,arrival_date,departure_date,guests_count) values('${ids.org}','${ids.prop}','${id}','${ids.type}','${ids.unit}',(select id from public.rate_plans where property_id='${ids.prop}' limit 1),'${day(a)}','${day(d)}',2);`;
  await db.exec(
    `insert into auth.users values('${ids.user}'),('${ids.house}');insert into public.organizations(id,name) values('${ids.org}','Tenant A');insert into public.organization_members(organization_id,user_id,role_id,all_properties) values('${ids.org}','${ids.user}',(select id from public.roles where key='owner'),true),('${ids.org}','${ids.house}',(select id from public.roles where key='housekeeping'),true);insert into public.properties(id,organization_id,name,concept) values('${ids.prop}','${ids.org}','Hotel A','hotel');insert into public.property_settings(organization_id,property_id) values('${ids.org}','${ids.prop}');insert into public.inventory_types(id,organization_id,property_id,name,sell_mode,max_occupancy,base_rate_minor) values('${ids.type}','${ids.org}','${ids.prop}','Suite','unit',2,100000);insert into public.units(id,organization_id,property_id,inventory_type_id,name) values('${ids.unit}','${ids.org}','${ids.prop}','${ids.type}','101');` +
      `insert into public.rate_plans(organization_id,property_id,name) values('${ids.org}','${ids.prop}','Base');` +
      `insert into public.guests(id,organization_id,first_name,last_name,email) values('${ids.guestEs}','${ids.org}','Ana','López','ana@example.com'),('${ids.guestNoMail}','${ids.org}','Sin','Correo',null);` +
      `insert into public.guests(id,organization_id,first_name,last_name,email,language) values('${ids.guestEn}','${ids.org}','John','Smith','john@example.com','en-US');` +
      res(ids.resNow, ids.guestEs, "NOW-1", 1, 3) +
      res(ids.resLater, ids.guestEs, "LATER-1", 10, 12) +
      res(ids.resEn, ids.guestEn, "EN-1", 1, 4) +
      res(ids.resNoMail, ids.guestNoMail, "NOMAIL-1", 1, 2) +
      res(ids.resCancelled, ids.guestEs, "CANCEL-1", 1, 2, "cancelled"),
  );
}, 90000);
afterAll(async () => {
  await db?.close();
});

test("templates store e-mail settings and reject bad buttons, documents and manual auto-send", async () => {
  await as(ids.user);
  const doc = await guestMail({
    type: "document.save",
    name: "Guía de llegada",
    fileName: "guia.pdf",
    contentType: "application/pdf",
    size: 2048,
    storagePath: `${ids.org}/${ids.prop}/a1/guia.pdf`,
  });
  await expect(
    guestMail({
      type: "document.save",
      name: "x",
      fileName: "x.pdf",
      contentType: "application/pdf",
      size: 10,
      storagePath: `other/${ids.prop}/x.pdf`,
    }),
  ).rejects.toThrow(/INVALID_DOCUMENT/);
  const saved = await command({
    ...template,
    buttons: [{ label: "Cómo llegar", url: "https://maps.example.com/?q={{confirmation_code}}" }],
    documentIds: [doc.id],
  });
  await command({ ...template, locale: "en", name: "Arrival", subject: "Your arrival" });
  await expect(command({ ...template, buttons: [{ label: "x", url: "javascript:alert(1)" }] })).rejects.toThrow(/INVALID_BUTTONS/);
  await expect(command({ ...template, buttons: [{ label: "x", url: "https://a.b/{{secret}}" }] })).rejects.toThrow(/UNKNOWN_VARIABLE/);
  await expect(command({ ...template, documentIds: ["90000000-0000-0000-0000-000000000009"] })).rejects.toThrow(/INVALID_DOCUMENT/);
  await expect(command({ ...template, trigger: "manual" })).rejects.toThrow(/AUTO_NEEDS_TRIGGER/);
  const row = await db.query<Record<string, any>>(
    "select auto_send,send_time::text,buttons,document_ids from public.message_templates where id=$1",
    [saved.id],
  );
  expect(row.rows[0]).toMatchObject({ auto_send: true, send_time: "10:00:00", buttons: [{ label: "Cómo llegar" }] });
  expect(row.rows[0].document_ids).toEqual([doc.id]);
  // Housekeeping can't see or touch guest e-mails.
  await as(ids.house);
  await expect(guestMail({ type: "state" })).rejects.toThrow();
});

test("cron claims each due e-mail once, in the guest's language, never to cancelled or e-mail-less stays", async () => {
  await as(ids.user);
  const state = await guestMail({ type: "state" });
  const codes = (list: { reservationId: string }[]) => list.map((x) => x.reservationId).sort();
  // Late bookings (arrival tomorrow) are due now; LATER-1 in 8 days.
  expect(codes(state.upcoming)).toEqual([ids.resNow, ids.resLater, ids.resEn].sort());
  await as(null);
  const first = await claim();
  expect(first.map((x) => x.recipient).sort()).toEqual(["ana@example.com", "john@example.com"]);
  const john = first.find((x) => x.recipient === "john@example.com")!;
  expect(john.template.locale).toBe("en");
  const ana = first.find((x) => x.recipient === "ana@example.com")!;
  expect(ana).toMatchObject({
    template: { locale: "es", buttons: [{ label: "Cómo llegar" }], documents: [{ fileName: "guia.pdf" }] },
    reservation: { confirmationCode: "NOW-1", adults: 2 },
    guest: { firstName: "Ana" },
    property: { name: "Hotel A", checkIn: "15:00" },
    unitName: "101",
  });
  expect(await claim()).toEqual([]);
  await db.query("select public.pms_service_guest_mail_done($1,true,null,'re_1','Tu llegada, Ana')", [ana.id]);
  await db.query("select public.pms_service_guest_mail_done($1,false,'Rebotó',null,null)", [john.id]);
  await as(ids.user);
  const after = await guestMail({ type: "state" });
  expect(codes(after.upcoming)).toEqual([ids.resLater]);
  expect(after.history.find((x: any) => x.id === ana.id)).toMatchObject({ status: "sent", subject: "Tu llegada, Ana" });
  expect(after.history.find((x: any) => x.id === john.id)).toMatchObject({ status: "failed", failure: "Rebotó" });
});

test("host can skip, restore, send now (once) and send manually", async () => {
  await as(ids.user);
  const { upcoming } = await guestMail({ type: "state" });
  const later = upcoming.find((x: any) => x.reservationId === ids.resLater);
  await guestMail({ type: "delivery.skip", templateId: later.templateId, reservationId: ids.resLater });
  expect((await guestMail({ type: "state" })).upcoming).toEqual([]);
  await guestMail({ type: "delivery.restore", templateId: later.templateId, reservationId: ids.resLater });
  expect((await guestMail({ type: "state" })).upcoming).toHaveLength(1);
  const payload = await guestMail({ type: "delivery.send", mode: "auto", templateId: later.templateId, reservationId: ids.resLater });
  expect(payload).toMatchObject({ kind: "auto", recipient: "ana@example.com", reservation: { confirmationCode: "LATER-1" } });
  await expect(
    guestMail({ type: "delivery.send", mode: "auto", templateId: later.templateId, reservationId: ids.resLater }),
  ).rejects.toThrow(/ALREADY_SENT/);
  const manual = await guestMail({ type: "delivery.send", mode: "manual", templateId: later.templateId, reservationId: ids.resNow });
  expect(manual.kind).toBe("manual");
  await expect(
    guestMail({ type: "delivery.send", mode: "manual", templateId: later.templateId, reservationId: ids.resNoMail }),
  ).rejects.toThrow(/NO_GUEST_EMAIL/);
  // Deleting a document detaches it from templates.
  const doc = (await guestMail({ type: "state" })).documents[0];
  expect((await guestMail({ type: "document.delete", id: doc.id })).storagePath).toContain("guia.pdf");
  const left = await db.query<{ n: number }>(
    "select count(*)::int n from public.message_templates where cardinality(document_ids)>0",
  );
  expect(left.rows[0].n).toBe(0);
});

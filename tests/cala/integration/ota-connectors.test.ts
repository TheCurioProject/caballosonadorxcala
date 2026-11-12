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
};
async function as(user: string | null) {
  await db.exec(
    user
      ? `reset role;select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`
      : `reset role;select set_config('request.jwt.claim.sub','',false);set role service_role;`,
  );
}
async function connector(command: Record<string, unknown>) {
  const r = await db.query<{ r: Record<string, unknown> }>(
    "select public.pms_connector($1::jsonb) r",
    [
      JSON.stringify({
        organizationId: ids.org,
        propertyId: ids.prop,
        ...command,
      }),
    ],
  );
  return r.rows[0].r as Record<string, unknown>;
}
const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
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
  await db.exec(
    `insert into auth.users values('${ids.user}'),('${ids.house}');insert into public.organizations(id,name) values('${ids.org}','Tenant A');insert into public.organization_members(organization_id,user_id,role_id,all_properties) values('${ids.org}','${ids.user}',(select id from public.roles where key='owner'),true),('${ids.org}','${ids.house}',(select id from public.roles where key='housekeeping'),true);insert into public.properties(id,organization_id,name,concept) values('${ids.prop}','${ids.org}','Hotel A','hotel');insert into public.property_settings(organization_id,property_id) values('${ids.org}','${ids.prop}');insert into public.inventory_types(id,organization_id,property_id,name,sell_mode,max_occupancy,base_rate_minor) values('${ids.type}','${ids.org}','${ids.prop}','Suite','unit',2,100000);insert into public.units(id,organization_id,property_id,inventory_type_id,name) values('${ids.unit}','${ids.org}','${ids.prop}','${ids.type}','101');`,
  );
}, 90000);
afterAll(async () => {
  await db?.close();
});

test("calendar link imports OTA events as blocks, updates, releases and keeps blocks on error", async () => {
  await as(ids.house);
  await expect(
    connector({
      type: "calendar.link",
      unitId: ids.unit,
      provider: "airbnb",
      url: "https://www.airbnb.com/calendar/ical/1.ics?s=x",
    }),
  ).rejects.toThrow();
  await as(ids.user);
  const { id } = await connector({
    type: "calendar.link",
    unitId: ids.unit,
    provider: "airbnb",
    url: "https://www.airbnb.com/calendar/ical/1.ics?s=x",
  });
  // Operators can never read the secret URL directly.
  await expect(db.query("select url from public.calendar_links")).rejects.toThrow();
  await as(null);
  const events = [
    { uid: "a@airbnb", arrival: day(3), departure: day(6), cancelled: false },
    { uid: "b@airbnb", arrival: day(10), departure: day(12), cancelled: false },
    { uid: "old@airbnb", arrival: day(-20), departure: day(-15), cancelled: false },
  ];
  const first = (
    await db.query<{ r: Record<string, number> }>(
      "select public.pms_service_calendar_apply($1,$2::jsonb,null) r",
      [id, JSON.stringify(events)],
    )
  ).rows[0].r;
  expect(first).toMatchObject({ ok: true, created: 2, released: 0 });
  const active = async () => {
    await db.exec("reset role");
    return (
      await db.query<{ start_date: string; end_date: string }>(
        "select start_date::text,end_date::text from public.inventory_blocks where status='active' order by start_date",
      )
    ).rows;
  };
  expect(await active()).toEqual([
    { start_date: day(3), end_date: day(6) },
    { start_date: day(10), end_date: day(12) },
  ]);
  // Failure keeps the dates closed.
  await as(null);
  await db.query("select public.pms_service_calendar_apply($1,'[]'::jsonb,'HTTP 500')", [id]);
  expect(await active()).toHaveLength(2);
  await as(null);
  // Moved stay + cancelled one.
  const second = (
    await db.query<{ r: Record<string, number> }>(
      "select public.pms_service_calendar_apply($1,$2::jsonb,null) r",
      [id, JSON.stringify([{ uid: "a@airbnb", arrival: day(4), departure: day(7), cancelled: false }])],
    )
  ).rows[0].r;
  expect(second).toMatchObject({ ok: true, created: 0, updated: 1, released: 1 });
  expect(await active()).toEqual([{ start_date: day(4), end_date: day(7) }]);

  await as(ids.user);
  const state = await connector({ type: "state" });
  expect((state.links as Array<Record<string, unknown>>)[0]).toMatchObject({
    provider: "airbnb",
    host: "www.airbnb.com",
    status: "ok",
    blockCount: 1,
  });
  await connector({ type: "calendar.unlink", id });
  expect(await active()).toEqual([]);
});

test("per-OTA export feeds reuse the token, skip their own import and record fetches", async () => {
  await as(ids.user);
  const a = await connector({ type: "calendar.export", unitId: ids.unit, provider: "booking" });
  const b = await connector({ type: "calendar.export", unitId: ids.unit, provider: "booking" });
  expect(a.token).toMatch(/^[a-f0-9]{64}$/);
  expect(b.token).toBe(a.token);
  const airbnb = await connector({ type: "calendar.export", unitId: ids.unit, provider: "airbnb" });
  const { id } = await connector({
    type: "calendar.link",
    unitId: ids.unit,
    provider: "airbnb",
    url: "https://www.airbnb.com/calendar/ical/2.ics",
  });
  await as(null);
  await db.query("select public.pms_service_calendar_apply($1,$2::jsonb,null)", [
    id,
    JSON.stringify([{ uid: "x@airbnb", arrival: day(20), departure: day(22), cancelled: false }]),
  ]);
  const exported = async (token: unknown) => {
    await db.exec("reset role;set role anon");
    return (
      await db.query<{ r: { events: Array<{ exportable: boolean; cancelled: boolean }> } }>(
        "select public.pms_public_calendar($1) r",
        [token],
      )
    ).rows[0].r.events.filter((e) => e.exportable && !e.cancelled).length;
  };
  expect(await exported(a.token)).toBe(1); // Booking.com sees the Airbnb stay
  expect(await exported(airbnb.token)).toBe(0); // Airbnb does not get its own stay back
  await as(null);
  await db.query("select public.pms_service_feed_touch($1,'Booking.com iCal fetcher')", [a.token]);
  await as(ids.user);
  const state = await connector({ type: "state" });
  const feed = (state.feeds as Array<Record<string, unknown>>).find((f) => f.provider === "booking");
  expect(feed).toMatchObject({ fetchCount: 1, agent: "Booking.com iCal fetcher" });
  // The generic share link no longer revokes OTA feeds.
  await db.query("select public.pms_command($1::jsonb,'ical-share-rotate-1')", [
    JSON.stringify({ type: "ical.rotate", organizationId: ids.org, propertyId: ids.prop, unitId: ids.unit }),
  ]);
  await as(null);
  expect(await exported(a.token)).toBe(1);
});

test("e-mail relay threads inbound messages, queues replies and records bounces", async () => {
  await as(ids.user);
  const { localPart } = await connector({ type: "inbox.enable" });
  expect(localPart).toMatch(/^cala-[a-f0-9]{14}$/);
  expect((await connector({ type: "inbox.enable" })).localPart).toBe(localPart);
  await as(null);
  const inbound = (extra: Record<string, unknown>) =>
    db.query<{ r: Record<string, string> }>("select public.pms_service_inbound($1::jsonb) r", [
      JSON.stringify({
        localPart,
        kind: "message",
        provider: "airbnb",
        replyTo: "abc123@reply.airbnb.com",
        guestName: "Ana",
        subject: "Mensaje de Ana",
        body: "¿A qué hora es la llegada?",
        from: "express@airbnb.com",
        ...extra,
      }),
    ]);
  const r1 = (await inbound({ resendId: "e1" })).rows[0].r;
  const r2 = (await inbound({ resendId: "e2", body: "Gracias" })).rows[0].r;
  expect(r2.threadId).toBe(r1.threadId);
  expect((await inbound({ resendId: "e2" })).rows[0].r.status).toBe("duplicate");
  await as(ids.user);
  const list = await connector({ type: "inbox.list" });
  expect(list.threads).toHaveLength(1);
  expect(list.messages).toHaveLength(2);
  await connector({ type: "thread.reply", threadId: r1.threadId, body: "A las 15:00" });
  await as(null);
  const claimed = (
    await db.query<{ r: Array<Record<string, string>> }>("select public.pms_service_outbox_claim(10) r")
  ).rows[0].r;
  expect(claimed).toHaveLength(1);
  expect(claimed[0]).toMatchObject({ replyTo: "abc123@reply.airbnb.com", localPart });
  await db.query("select public.pms_service_outbox_done($1,true,null,'resend-1')", [claimed[0].id]);
  await db.query<{ r: Record<string, string> }>("select public.pms_service_inbound($1::jsonb) r", [
    JSON.stringify({ localPart, kind: "bounce", resendId: "e3", replyTo: "abc123@reply.airbnb.com", summary: "Rechazado" }),
  ]);
  await as(ids.user);
  const after = await connector({ type: "inbox.list" });
  const out = (after.messages as Array<Record<string, string>>).find((m) => m.direction === "outbound");
  expect(out).toMatchObject({ status: "failed", failure: "Rechazado" });
  await as(ids.house);
  await expect(connector({ type: "inbox.list" })).rejects.toThrow();
});

test("simplified relay: settings stored, threads keyed by OTA link, replies recorded as sent from the OTA", async () => {
  await as(null);
  await db.query("select public.pms_service_mail_settings_save('abcd.resend.app','wh_1','whsec_x')");
  expect((await db.query<{ r: Record<string, string> }>("select public.pms_service_mail_settings() r")).rows[0].r).toEqual({
    domain: "abcd.resend.app",
    webhookId: "wh_1",
    webhookSecret: "whsec_x",
  });
  await as(ids.user);
  const { localPart } = await connector({ type: "inbox.enable" });
  await as(null);
  const link = "https://www.airbnb.com/hosting/inbox/folder/all/thread/987";
  const send = (resendId: string, guestName: string) =>
    db.query<{ r: Record<string, string> }>("select public.pms_service_inbound($1::jsonb) r", [
      JSON.stringify({ localPart, kind: "message", provider: "airbnb", guestName, externalUrl: link, resendId, body: "Hola" }),
    ]);
  const a = (await send("s1", "Marta")).rows[0].r;
  const b = (await send("s2", "Marta R.")).rows[0].r;
  expect(b.threadId).toBe(a.threadId);
  await as(ids.user);
  const r = await connector({ type: "thread.reply", threadId: a.threadId, body: "¡Claro!", manual: true });
  expect(r.status).toBe("recorded");
  const list = await connector({ type: "inbox.list" });
  const thread = (list.threads as Array<Record<string, unknown>>).find((t) => t.id === a.threadId);
  expect(thread?.externalUrl).toBe(link);
  // Settings are never readable by operators.
  await expect(db.query("select public.pms_service_mail_settings()")).rejects.toThrow();
});

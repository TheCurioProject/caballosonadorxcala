import { beforeAll, afterAll, test, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { defaultWorkspacePreferences } from "@/cala/domain/workspace/preferences";
let db: PGlite;
const ids = {
  org: "10000000-0000-0000-0000-000000000001",
  other: "10000000-0000-0000-0000-000000000002",
  user: "20000000-0000-0000-0000-000000000001",
  house: "20000000-0000-0000-0000-000000000002",
  manager: "20000000-0000-0000-0000-000000000003",
  prop: "30000000-0000-0000-0000-000000000001",
  otherProp: "30000000-0000-0000-0000-000000000002",
  scopeProp: "30000000-0000-0000-0000-000000000003",
  type: "40000000-0000-0000-0000-000000000001",
  unit: "50000000-0000-0000-0000-000000000001",
  guest: "60000000-0000-0000-0000-000000000001",
  plan: "70000000-0000-0000-0000-000000000001",
};
async function as(user: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${user}',false);set role authenticated;`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`,
  );
  for (const name of readdirSync("supabase/migrations")
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
  await db.exec(
    `insert into auth.users values('${ids.user}'),('${ids.house}'),('${ids.manager}');insert into public.organizations(id,name) values('${ids.org}','Tenant A'),('${ids.other}','Tenant B');insert into public.organization_members(organization_id,user_id,role_id,all_properties) values('${ids.org}','${ids.user}',(select id from public.roles where key='owner'),true),('${ids.org}','${ids.house}',(select id from public.roles where key='housekeeping'),true),('${ids.org}','${ids.manager}',(select id from public.roles where key='manager'),false);insert into public.properties(id,organization_id,name,concept) values('${ids.prop}','${ids.org}','Hotel A','hotel'),('${ids.otherProp}','${ids.other}','Hotel B','hotel'),('${ids.scopeProp}','${ids.org}','Casa A','entire_home');insert into public.member_property_scopes values('${ids.org}','${ids.manager}','${ids.prop}');insert into public.property_settings(organization_id,property_id) values('${ids.org}','${ids.prop}');insert into public.inventory_types(id,organization_id,property_id,name,sell_mode,max_occupancy,base_rate_minor) values('${ids.type}','${ids.org}','${ids.prop}','Suite','unit',2,100000);insert into public.units(id,organization_id,property_id,inventory_type_id,name) values('${ids.unit}','${ids.org}','${ids.prop}','${ids.type}','101');insert into public.guests(id,organization_id,first_name,last_name) values('${ids.guest}','${ids.org}','Ficticia','Prueba');insert into public.rate_plans(id,organization_id,property_id,name) values('${ids.plan}','${ids.org}','${ids.prop}','Flexible');`,
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});
test("workspace preference RPC isolates users, versions writes and rejects direct mutation", async () => {
  await as(ids.user);
  const command = {
    type: "workspace.preferences.save",
    organizationId: ids.org,
    version: 0,
    preferences: defaultWorkspacePreferences,
    userId: ids.house,
  };
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify(command),
    "sql-prefs-first",
  ]);
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify(command),
    "sql-prefs-first",
  ]);
  expect(
    (
      await db.query<{ user_id: string; version: number }>(
        "select user_id,version::int from public.workspace_preferences",
      )
    ).rows,
  ).toEqual([{ user_id: ids.user, version: 1 }]);
  await expect(
    db.exec("update public.workspace_preferences set version=99"),
  ).rejects.toThrow();
  await expect(
    db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify(command),
      "sql-prefs-stale",
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify({
        ...command,
        version: 1,
        preferences: {
          ...defaultWorkspacePreferences,
          calendar: { ...defaultWorkspacePreferences.calendar, days: 999 },
        },
      }),
      "sql-prefs-invalid",
    ]),
  ).rejects.toThrow();
  await as(ids.house);
  expect(
    (await db.query("select * from public.workspace_preferences")).rows,
  ).toEqual([]);
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify(command),
    "sql-prefs-own-house",
  ]);
  expect(
    (
      await db.query<{ user_id: string }>(
        "select user_id from public.workspace_preferences",
      )
    ).rows,
  ).toEqual([{ user_id: ids.house }]);
  await db.exec("reset role");
});
test("guest profile RPC preserves omitted fields without allowing lost updates or leaking PII", async () => {
  await as(ids.user);
  const version = (
    await db.query<{ version: number }>(
      "select version::int from public.guests where id=$1",
      [ids.guest],
    )
  ).rows[0].version;
  const base = {
    type: "guest.save",
    organizationId: ids.org,
    propertyId: ids.prop,
    id: ids.guest,
    version,
    firstName: "Persona",
    lastName: "Sintética",
    email: "synthetic@example.com",
    phone: "",
    country: "MX",
    notes: "",
  };
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify({
      ...base,
      address: "Dirección sintética privada",
      city: "Tepic",
      region: "Nayarit",
      postalCode: "63000",
      language: "en-GB",
    }),
    "sql-profile-extended",
  ]);
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify({ ...base, version: version + 1, firstName: "Editada" }),
    "sql-profile-older-writer",
  ]);
  expect(
    (
      await db.query(
        "select address,language,version::int from public.guests where id=$1",
        [ids.guest],
      )
    ).rows[0],
  ).toEqual({
    address: "Dirección sintética privada",
    language: "en-GB",
    version: version + 2,
  });
  await expect(
    db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify(base),
      "sql-profile-stale",
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify({
        ...base,
        version: version + 2,
        address: { hidden: true },
      }),
      "sql-profile-invalid",
    ]),
  ).rejects.toThrow();
  await as(ids.house);
  await expect(
    db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify(base),
      "sql-profile-forbidden",
    ]),
  ).rejects.toThrow();
  expect((await db.query("select * from public.guests")).rows).toEqual([]);
  await db.exec("reset role");
  expect(
    (
      await db.query(
        "select * from public.audit_logs where after_json::text like '%Dirección sintética privada%'",
      )
    ).rows,
  ).toEqual([]);
});
test("public availability RPC exposes only dates to anonymous readers and supports scoped, revocable links", async () => {
  await as(ids.user);
  const command = {
    type: "ical.rotate",
    organizationId: ids.org,
    propertyId: ids.prop,
    unitId: ids.unit,
  };
  const rotate = async (key: string) =>
    (
      await db.query<{ response: { secretUrl: string } }>(
        "select public.pms_command($1::jsonb,$2) response",
        [JSON.stringify(command), key],
      )
    ).rows[0].response.secretUrl.split("token=")[1];
  const token = await rotate("sql-public-first");
  expect(await rotate("sql-public-first")).toBe(token);
  await db.exec("reset role;set role anon");
  const result = await db.query<{
    data: {
      today: string;
      coverageStart: string;
      coverageEnd: string;
      events: unknown[];
    };
  }>("select public.pms_public_calendar($1) data", [token]);
  expect(Object.keys(result.rows[0].data).sort()).toEqual([
    "coverageEnd",
    "coverageStart",
    "events",
    "today",
  ]);
  expect(JSON.stringify(result.rows[0].data)).not.toContain(ids.guest);
  await expect(db.exec("select * from public.ical_feeds")).rejects.toThrow();
  await expect(
    db.query("select public.pms_public_calendar($1)", ["0".repeat(64)]),
  ).rejects.toThrow(/NOT_FOUND/);
  await expect(
    db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify(command),
      "sql-anon-rotate",
    ]),
  ).rejects.toThrow();
  await as(ids.house);
  await expect(rotate("sql-house-rotate")).rejects.toThrow();
  await as(ids.user);
  await expect(
    db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify({ ...command, propertyId: ids.otherProp }),
      "sql-cross-rotate",
    ]),
  ).rejects.toThrow();
  const replacement = await rotate("sql-public-replacement");
  await db.exec("reset role;set role anon");
  await expect(
    db.query("select public.pms_public_calendar($1)", [token]),
  ).rejects.toThrow(/NOT_FOUND/);
  await db.exec(
    `reset role;update public.organization_members set status='suspended' where user_id='${ids.user}'`,
  );
  await db.exec("set role anon");
  await expect(
    db.query("select public.pms_public_calendar($1)", [replacement]),
  ).rejects.toThrow(/NOT_FOUND/);
  await db.exec(
    `reset role;update public.organization_members set status='active' where user_id='${ids.user}'`,
  );
  await as(ids.user);
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify({ ...command, type: "ical.revoke" }),
    "sql-public-revoke",
  ]);
  await db.exec("reset role;set role anon");
  await expect(
    db.query("select public.pms_public_calendar($1)", [replacement]),
  ).rejects.toThrow(/NOT_FOUND/);
  await db.exec("reset role");
});
test("public availability SQL includes unassigned nights and imported blocks while preserving cancellation", async () => {
  await db.exec("reset role;begin");
  try {
    await as(ids.user);
    const dates = (
      await db.query<{
        arrival: string;
        departure: string;
        block_start: string;
        block_end: string;
      }>(
        "select ((now() at time zone 'America/Mexico_City')::date+500)::text arrival,((now() at time zone 'America/Mexico_City')::date+502)::text departure,((now() at time zone 'America/Mexico_City')::date+505)::text block_start,((now() at time zone 'America/Mexico_City')::date+506)::text block_end",
      )
    ).rows[0];
    const booking = (
      await db.query<{ response: { id: string } }>(
        "select public.pms_command($1::jsonb,$2) response",
        [
          JSON.stringify({
            type: "reservation.save",
            organizationId: ids.org,
            propertyId: ids.prop,
            guestId: ids.guest,
            inventoryTypeId: ids.type,
            unitId: null,
            ratePlanId: ids.plan,
            arrival: dates.arrival,
            departure: dates.departure,
            adults: 1,
            children: 0,
            status: "confirmed",
            notes: "Private SQL note",
          }),
          "public-sql-unassigned",
        ],
      )
    ).rows[0].response.id;
    const result = (
      await db.query<{ response: { secretUrl: string } }>(
        "select public.pms_command($1::jsonb,$2) response",
        [
          JSON.stringify({
            type: "ical.rotate",
            organizationId: ids.org,
            propertyId: ids.prop,
            unitId: ids.unit,
          }),
          "public-sql-events",
        ],
      )
    ).rows[0].response;
    const token = result.secretUrl.split("token=")[1];
    await db.exec("reset role");
    const block = (
      await db.query<{ id: string }>(
        "insert into public.inventory_blocks(organization_id,property_id,unit_id,start_date,end_date,reason) values($1,$2,$3,$4,$5,'Private SQL reason') returning id",
        [ids.org, ids.prop, ids.unit, dates.block_start, dates.block_end],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.ical_events(organization_id,property_id,unit_id,source_calendar,uid,sequence,fingerprint,block_id) values($1,$2,$3,'Private source','synthetic-event',1,'synthetic-fingerprint',$4)",
      [ids.org, ids.prop, ids.unit, block],
    );
    await db.exec("set role anon");
    const read = async () =>
      (
        await db.query<{
          data: {
            events: {
              arrival: string;
              departure: string;
              cancelled: boolean;
              exportable: boolean;
              uid: string;
            }[];
          };
        }>("select public.pms_public_calendar($1) data", [token])
      ).rows[0].data;
    const calendar = await read();
    expect(calendar.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          arrival: dates.arrival,
          departure: dates.departure,
          cancelled: false,
          exportable: true,
        }),
        expect.objectContaining({
          arrival: dates.block_start,
          cancelled: false,
          exportable: false,
        }),
      ]),
    );
    for (const privateValue of ["Private", ids.guest, ids.unit, booking, block])
      expect(JSON.stringify(calendar)).not.toContain(privateValue);
    await as(ids.user);
    await db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify({
        type: "reservation.transition",
        organizationId: ids.org,
        propertyId: ids.prop,
        id: booking,
        version: 1,
        status: "cancelled",
      }),
      "public-sql-cancel",
    ]);
    await db.exec("reset role;set role anon");
    expect(
      (await read()).events.find((e) => e.arrival === dates.arrival)?.cancelled,
    ).toBe(true);
  } finally {
    await db.exec("rollback;reset role");
  }
});
test("bulk rates reject an existing rate from another tenant before an upsert can change it", async () => {
  await db.exec("reset role;begin");
  try {
    const foreignType = "40000000-0000-0000-0000-000000000088",
      foreignPlan = "70000000-0000-0000-0000-000000000088";
    await db.query(
      "insert into public.inventory_types(id,organization_id,property_id,name,sell_mode,max_occupancy,base_rate_minor) values($1,$2,$3,'Private type','unit',2,80000)",
      [foreignType, ids.other, ids.otherProp],
    );
    await db.query(
      "insert into public.rate_plans(id,organization_id,property_id,name) values($1,$2,$3,'Private plan')",
      [foreignPlan, ids.other, ids.otherProp],
    );
    await db.query(
      "insert into public.rate_day(organization_id,property_id,rate_plan_id,inventory_type_id,stay_date,amount_minor,currency) values($1,$2,$3,$4,'2031-04-01',80000,'MXN')",
      [ids.other, ids.otherProp, foreignPlan, foreignType],
    );
    await as(ids.user);
    await db.exec("savepoint forbidden_rate");
    await expect(
      db.query("select public.pms_command($1::jsonb,$2)", [
        JSON.stringify({
          type: "rates.bulk",
          organizationId: ids.org,
          propertyId: ids.prop,
          ratePlanId: foreignPlan,
          inventoryTypeId: foreignType,
          arrival: "2031-04-01",
          departure: "2031-04-02",
          amountMinor: 1,
          minStay: 1,
          maxStay: 730,
          closed: false,
          cta: false,
          ctd: false,
          expectedVersions: { "2031-04-01": 1 },
        }),
        "rates-cross-tenant-guard",
      ]),
    ).rejects.toThrow(/INVALID_RATE/);
    await db.exec(
      "rollback to savepoint forbidden_rate;release savepoint forbidden_rate",
    );
    await db.exec("reset role");
    expect(
      (
        await db.query<{ amount: number }>(
          "select amount_minor::int amount from public.rate_day where rate_plan_id=$1",
          [foreignPlan],
        )
      ).rows[0].amount,
    ).toBe(80000);
    await as(ids.user);
    const own = {
      type: "rates.bulk",
      organizationId: ids.org,
      propertyId: ids.prop,
      ratePlanId: ids.plan,
      inventoryTypeId: ids.type,
      arrival: "2031-04-01",
      departure: "2031-04-02",
      amountMinor: 54000,
      minStay: 2,
      maxStay: 30,
      closed: false,
      cta: false,
      ctd: false,
      expectedVersions: { "2031-04-01": 0 },
    };
    const saved = await db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify(own),
      "rates-own-tuple-valid",
    ]);
    expect(
      (
        await db.query("select public.pms_command($1::jsonb,$2)", [
          JSON.stringify(own),
          "rates-own-tuple-valid",
        ])
      ).rows,
    ).toEqual(saved.rows);
    await expect(
      db.query("select public.pms_command($1::jsonb,$2)", [
        JSON.stringify(own),
        "rates-own-tuple-stale",
      ]),
    ).rejects.toThrow(/VERSION_CONFLICT/);
  } finally {
    await db.exec("rollback;reset role");
  }
});
test("all application tables have RLS and anon has no grants", async () => {
  const result = await db.query<{ name: string }>(
    `select tablename as name from pg_tables where schemaname='public' and not rowsecurity`,
  );
  expect(result.rows).toEqual([]);
  const grants = await db.query(
    `select * from information_schema.role_table_grants where table_schema='public' and grantee='anon'`,
  );
  expect(grants.rows).toEqual([]);
});
test("SQL policies isolate tenant and deny direct mutation", async () => {
  await as(ids.user);
  const result = await db.query<{ name: string }>(
    "select name from public.properties order by name",
  );
  expect(result.rows.map((x) => x.name)).toEqual(["Casa A", "Hotel A"]);
  await expect(
    db.exec(
      `update public.properties set name='attack' where id='${ids.otherProp}'`,
    ),
  ).rejects.toThrow();
  await db.exec("reset role");
});
test("property scope and suspension are enforced in SQL", async () => {
  await as(ids.manager);
  expect((await db.query("select * from public.properties")).rows).toHaveLength(
    1,
  );
  await db.exec(
    `reset role;update public.organization_members set status='suspended' where user_id='${ids.manager}'`,
  );
  await as(ids.manager);
  expect((await db.query("select * from public.properties")).rows).toHaveLength(
    0,
  );
  await db.exec("reset role");
});
test("property command validates timezone and links curated amenities", async () => {
  await as(ids.user);
  const response = await db.query<{ response: { id: string } }>(
    "select public.pms_command($1::jsonb,$2) response",
    [
      JSON.stringify({
        type: "property.create",
        organizationId: ids.org,
        name: "Casa horaria",
        concept: "entire_home",
        city: "Bogotá",
        address: "Calle de prueba 1",
        currency: "USD",
        timezone: "America/Bogota",
        unitCount: 1,
        maxOccupancy: 4,
        baseRateMinor: 12500,
        sellMode: "unit",
        bedrooms: 2,
        beds: 2,
        bathrooms: 1,
        amenities: ["wifi", "pool"],
        checkIn: "15:00",
        checkOut: "11:00",
        policy: "Política de prueba",
        taxBps: 0,
      }),
      "property-options-key",
    ],
  );
  const propertyId = response.rows[0].response.id;
  expect(
    (
      await db.query<{ timezone: string }>(
        "select timezone from public.properties where id=$1::uuid",
        [propertyId],
      )
    ).rows[0].timezone,
  ).toBe("America/Bogota");
  expect(
    (
      await db.query<{ key: string }>(
        "select a.key from public.property_amenities pa join public.amenities a on a.id=pa.amenity_id where pa.property_id=$1::uuid order by a.key",
        [propertyId],
      )
    ).rows.map((row) => row.key),
  ).toEqual(["pool", "wifi"]);
  await db.exec("reset role");
});
test("housekeeping cannot read finance or guests", async () => {
  await as(ids.house);
  expect((await db.query("select * from public.guests")).rows).toHaveLength(0);
  expect((await db.query("select * from public.payments")).rows).toHaveLength(
    0,
  );
  await expect(
    db.query("select public.pms_save_reservation($1::jsonb,$2)", [
      JSON.stringify({ organizationId: ids.org, propertyId: ids.prop }),
      "denied-key",
    ]),
  ).rejects.toThrow();
  await db.exec("reset role");
});
const command = {
  type: "reservation.save",
  organizationId: ids.org,
  propertyId: ids.prop,
  guestId: ids.guest,
  inventoryTypeId: ids.type,
  unitId: ids.unit,
  ratePlanId: ids.plan,
  arrival: "2027-01-10",
  departure: "2027-01-13",
  adults: 2,
  children: 0,
  status: "confirmed",
  notes: "",
};
test("PostgreSQL transaction atomically enforces conflict, dedupe, cancel and outbox", async () => {
  await as(ids.user);
  const create = () =>
    db.query<{ response: { id: string } }>(
      "select public.pms_save_reservation($1::jsonb,$2) response",
      [JSON.stringify(command), "reservation-key"],
    );
  const first = await create();
  const id = first.rows[0].response.id;
  expect((await create()).rows).toEqual(first.rows);
  await expect(
    db.query("select public.pms_save_reservation($1::jsonb,$2)", [
      JSON.stringify(command),
      "conflict-key",
    ]),
  ).rejects.toThrow(/UNIT_CONFLICT/);
  expect(
    (await db.query("select id from public.reservations")).rows,
  ).toHaveLength(1);
  const cancel = {
    type: "reservation.transition",
    organizationId: ids.org,
    propertyId: ids.prop,
    id,
    status: "cancelled",
    version: 1,
  };
  await db.query("select public.pms_transition_reservation($1::jsonb,$2)", [
    JSON.stringify(cancel),
    "cancel-key",
  ]);
  await db.query("select public.pms_transition_reservation($1::jsonb,$2)", [
    JSON.stringify(cancel),
    "cancel-key",
  ]);
  await expect(
    db.query("select public.pms_save_reservation($1::jsonb,$2)", [
      JSON.stringify(command),
      "replacement-key",
    ]),
  ).resolves.toBeDefined();
  expect(
    (await db.query("select * from public.outbox_events")).rows,
  ).toHaveLength(3);
  await db.exec("reset role");
});

test("local Supabase seed is executable and contains no sample business data", async () => {
  const before = (await db.query("select * from public.properties")).rows
    .length;
  await db.exec(
    "reset role;alter table auth.users add column email text,add column raw_app_meta_data jsonb,add column raw_user_meta_data jsonb,add column created_at timestamptz,add column updated_at timestamptz;",
  );
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  expect((await db.query("select * from public.properties")).rows).toHaveLength(
    before,
  );
});

test("sensitive reservation columns require the redacted RPC", async () => {
  await as(ids.user);
  await expect(
    db.query("select notes,total_minor from public.reservations"),
  ).rejects.toThrow();
  expect(
    (
      await db.query<{ data: unknown[] }>(
        "select public.pms_reservations($1::uuid,$2::uuid) data",
        [ids.org, ids.prop],
      )
    ).rows[0].data.length,
  ).toBeGreaterThan(0);
  await db.exec("reset role");
});

test("SQL daily projection reserves every child bed when its whole room is sold", async () => {
  await db.exec("reset role");
  const childType = "40000000-0000-0000-0000-000000000099";
  await db.exec(
    `insert into public.inventory_types(id,organization_id,property_id,name,sell_mode,max_occupancy,base_rate_minor) values('${childType}','${ids.org}','${ids.prop}','Beds','bed',1,10000);insert into public.units(organization_id,property_id,inventory_type_id,name,parent_unit_id) values('${ids.org}','${ids.prop}','${childType}','Bed A','${ids.unit}'),('${ids.org}','${ids.prop}','${childType}','Bed B','${ids.unit}');select pms_private.recalculate('${ids.prop}','2027-01-10','2027-01-13');`,
  );
  const result = await db.query<{ sold: number; sellable: number }>(
    "select sold,sellable from public.inventory_day where inventory_type_id=$1::uuid",
    [childType],
  );
  expect(result.rows).toHaveLength(3);
  expect(result.rows.every((r) => r.sold === 2 && r.sellable === 0)).toBe(true);
});

test("SQL move preserves money and source, rejects stale state and occupied destinations atomically", async () => {
  await db.exec("reset role");
  const unit2 = "50000000-0000-0000-0000-000000000102";
  await db.query(
    "insert into public.units(id,organization_id,property_id,inventory_type_id,name) values($1,$2,$3,$4,'102')",
    [unit2, ids.org, ids.prop, ids.type],
  );
  await as(ids.user);
  const saved = await db.query<{ response: { id: string } }>(
    "select public.pms_command($1::jsonb,$2) response",
    [
      JSON.stringify({
        ...command,
        arrival: "2028-02-01",
        departure: "2028-02-04",
      }),
      "sql-move-create",
    ],
  );
  const id = saved.rows[0].response.id;
  await db.exec("reset role");
  await db.query(
    "update public.reservations set source='booking.com' where id=$1",
    [id],
  );
  await as(ids.user);
  const move = {
    type: "reservation.move",
    organizationId: ids.org,
    propertyId: ids.prop,
    id,
    version: 1,
    unitId: unit2,
    arrival: "2028-02-01",
    departure: "2028-02-04",
    pricing: "preserve",
  };
  const first = await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify(move),
    "sql-move-first",
  ]);
  expect(
    (
      await db.query("select public.pms_command($1::jsonb,$2)", [
        JSON.stringify(move),
        "sql-move-first",
      ])
    ).rows,
  ).toEqual(first.rows);
  await expect(
    db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify({ ...move, version: 1, unitId: ids.unit }),
      "sql-move-stale",
    ]),
  ).rejects.toThrow(/VERSION_CONFLICT/);
  await expect(
    db.query("select public.pms_move_reservation($1::jsonb,$2)", [
      JSON.stringify({ ...move, version: null, unitId: ids.unit }),
      "sql-move-null-version",
    ]),
  ).rejects.toThrow(/VERSION_CONFLICT/);
  await db.exec("reset role");
  const row = await db.query<{
    source: string;
    total_minor: number;
    version: number;
  }>("select source,total_minor,version from public.reservations where id=$1", [
    id,
  ]);
  expect(row.rows[0]).toEqual({
    source: "booking.com",
    total_minor: 300000,
    version: 2,
  });
  expect(
    (
      await db.query(
        "select * from public.audit_logs where action='reservation.move' and entity_id=$1",
        [id],
      )
    ).rows,
  ).toHaveLength(1);
  await as(ids.user);
  // A second reservation now occupies 101; moving back must fail without changing version.
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify({
      ...command,
      arrival: "2028-02-01",
      departure: "2028-02-04",
    }),
    "sql-move-second-create",
  ]);
  await expect(
    db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify({ ...move, version: 2, unitId: ids.unit }),
      "sql-move-unit-conflict",
    ]),
  ).rejects.toThrow(/UNIT_CONFLICT/);
  await db.exec("reset role");
  expect(
    (
      await db.query<{ version: number }>(
        "select version from public.reservations where id=$1",
        [id],
      )
    ).rows[0].version,
  ).toBe(2);
});

test("SQL messaging and market use scoped RPC, RLS and truthful blocked delivery states", async () => {
  await as(ids.user);
  const reservation = (
    await db.query<{ id: string }>(
      "select id from public.reservations where status='confirmed' order by arrival_date limit 1",
    )
  ).rows[0].id;
  const draft = {
    type: "message.save",
    organizationId: ids.org,
    propertyId: ids.prop,
    reservationId: reservation,
    subject: "Arrival",
    body: "Confidential note",
    mode: "prepare",
    scheduledAt: null,
  };
  const saved = await db.query<{ response: { id: string; warning: string } }>(
    "select public.pms_command($1::jsonb,$2) response",
    [JSON.stringify(draft), "sql-message-prepare"],
  );
  expect(saved.rows[0].response.warning).toContain("sin enviar");
  const messages = await db.query<{ status: string }>(
    "select status from public.message_entries where id=$1",
    [saved.rows[0].response.id],
  );
  expect(messages.rows[0].status).toBe("blocked");
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify(draft),
    "sql-message-prepare",
  ]);
  expect(
    (await db.query("select * from public.message_entries")).rows,
  ).toHaveLength(1);
  await expect(
    db.query("update public.message_entries set status='sent' where id=$1", [
      saved.rows[0].response.id,
    ]),
  ).rejects.toThrow();
  const template = {
    type: "template.save",
    organizationId: ids.org,
    propertyId: ids.prop,
    name: "Welcome",
    locale: "es",
    subject: "Hola",
    body: "Hola {{guest_first_name}}",
    trigger: "arrival",
    offsetDays: -1,
  };
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify(template),
    "sql-template-create",
  ]);
  await expect(
    db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify({ ...template, body: "{{secret}}" }),
      "sql-template-variable",
    ]),
  ).rejects.toThrow(/UNKNOWN_VARIABLE/);
  const observation = {
    date: "2028-02-01",
    observedOn: "2026-01-01",
    source: "licensed",
    market: "Centro",
    currency: "MXN",
    adrMinor: 125000,
    occupancyBps: 6500,
    sampleSize: 20,
  };
  const market = {
    type: "market.import",
    organizationId: ids.org,
    propertyId: ids.prop,
    rows: [observation],
  };
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify(market),
    "sql-market-import",
  ]);
  await expect(
    db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify({
        ...market,
        rows: [
          { ...observation, date: "2028-02-02" },
          { ...observation, currency: "USD" },
        ],
      }),
      "sql-market-currency",
    ]),
  ).rejects.toThrow(/MARKET_CURRENCY/);
  expect(
    (await db.query("select * from public.market_observations")).rows,
  ).toHaveLength(1);
  await as(ids.house);
  for (const table of [
    "conversations",
    "message_entries",
    "message_templates",
    "market_observations",
  ])
    expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(
      0,
    );
  await expect(
    db.query("select public.pms_command($1::jsonb,$2)", [
      JSON.stringify(draft),
      "sql-housekeeper-message",
    ]),
  ).rejects.toThrow(/FORBIDDEN/);
  await db.exec("reset role");
  await db.query(
    "insert into public.market_observations(organization_id,property_id,stay_date,observed_on,source,market,currency,adr_minor,occupancy_bps,sample_size) values($1,$2,'2028-02-01','2026-01-01','other','Other','MXN',1,1,1)",
    [ids.other, ids.otherProp],
  );
  await as(ids.user);
  expect(
    (await db.query("select * from public.market_observations")).rows,
  ).toHaveLength(1);
  await db.exec("reset role");
});

test("SQL move recalculation updates room revenue without overwriting extra charges", async () => {
  await as(ids.user);
  const created = await db.query<{ response: { id: string } }>(
    "select public.pms_command($1::jsonb,$2) response",
    [
      JSON.stringify({
        ...command,
        arrival: "2030-02-01",
        departure: "2030-02-04",
      }),
      "sql-reprice-create",
    ],
  );
  const id = created.rows[0].response.id;
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify({
      type: "folio.charge",
      organizationId: ids.org,
      propertyId: ids.prop,
      reservationId: id,
      description: "Extra intacto",
      amountMinor: 12345,
    }),
    "sql-reprice-extra",
  ]);
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify({
      type: "rates.bulk",
      organizationId: ids.org,
      propertyId: ids.prop,
      inventoryTypeId: ids.type,
      ratePlanId: ids.plan,
      arrival: "2030-02-01",
      departure: "2030-02-04",
      amountMinor: 200000,
      minStay: 1,
      maxStay: 730,
      closed: false,
      cta: false,
      ctd: false,
      expectedVersions: {},
    }),
    "sql-reprice-rates",
  ]);
  await db.query("select public.pms_command($1::jsonb,$2)", [
    JSON.stringify({
      type: "reservation.move",
      organizationId: ids.org,
      propertyId: ids.prop,
      id,
      version: 1,
      unitId: "50000000-0000-0000-0000-000000000102",
      arrival: "2030-02-01",
      departure: "2030-02-04",
      pricing: "recalculate",
    }),
    "sql-reprice-move",
  ]);
  const items = await db.query<{ type: string; total_minor: number }>(
    "select i.type,i.total_minor from public.folio_items i join public.folios f on f.id=i.folio_id where f.reservation_id=$1",
    [id],
  );
  expect(items.rows.find((i) => i.type === "room")?.total_minor).toBe(600000);
  expect(items.rows.find((i) => i.type === "charge")?.total_minor).toBe(12345);
  await db.exec("reset role");
});

test("SQL workspace management: inventory, units, property and ranked team commands", async () => {
  const run = (command: Record<string, unknown>, key: string) =>
    db
      .query("select public.pms_command($1::jsonb,$2)", [
        JSON.stringify(command),
        key,
      ])
      .catch((error: Error) => {
        throw new Error(`${key}: ${error.message}`);
      });
  const invitee = "20000000-0000-0000-0000-0000000000aa";
  await db.exec(
    `reset role;alter table auth.users add column if not exists email text,add column if not exists raw_user_meta_data jsonb,add column if not exists last_sign_in_at timestamptz;insert into auth.users(id,email,raw_user_meta_data) values('${invitee}','nueva@example.com','{"name":"Nueva Persona"}');update public.organization_members set status='active' where user_id='${ids.manager}';`,
  );
  await as(ids.user);
  await run(
    {
      type: "inventory.update",
      organizationId: ids.org,
      propertyId: ids.prop,
      id: ids.type,
      name: "Suite Jardín",
      maxOccupancy: 3,
      baseRateMinor: 180000,
      active: true,
    },
    "sql-manage-type",
  );
  const unitVersion = (
    await db.query<{ version: number }>(
      "select version::int from public.units where id=$1",
      [ids.unit],
    )
  ).rows[0].version;
  await run(
    {
      type: "unit.update",
      organizationId: ids.org,
      propertyId: ids.prop,
      id: ids.unit,
      name: "101 · Jardín",
      inventoryTypeId: ids.type,
      active: true,
      attributes: { bedrooms: 1, beds: 2, bathrooms: 1 },
      version: unitVersion,
    },
    "sql-manage-unit",
  );
  const propertyVersion = (
    await db.query<{ version: number }>(
      "select version::int from public.properties where id=$1",
      [ids.prop],
    )
  ).rows[0].version;
  await run(
    {
      type: "property.update",
      organizationId: ids.org,
      propertyId: ids.prop,
      name: "Casa Prueba",
      city: "Sayulita",
      address: "Calle 1",
      checkIn: "16:00",
      checkOut: "10:30",
      taxBps: 1600,
      policy: "Política",
      allowedOverbooking: 0,
      version: propertyVersion,
    },
    "sql-manage-property",
  );
  await db.exec("reset role");
  expect(
    (
      await db.query(
        "select t.name,t.max_occupancy,t.base_rate_minor::int rate,u.name unit,(select value_json from public.unit_attributes where unit_id=u.id and key='beds') beds,to_char(s.check_in_from,'HH24:MI') checkin,s.tax_bps,p.address from public.inventory_types t join public.units u on u.inventory_type_id=t.id join public.properties p on p.id=t.property_id join public.property_settings s on s.property_id=p.id where t.id=$1 and u.id=$2",
        [ids.type, ids.unit],
      )
    ).rows,
  ).toEqual([
    {
      name: "Suite Jardín",
      max_occupancy: 3,
      rate: 180000,
      unit: "101 · Jardín",
      beds: 2,
      checkin: "16:00",
      tax_bps: 1600,
      address: "Calle 1",
    },
  ]);

  // Housekeeping cannot manage the team.
  await as(ids.house);
  await expect(
    run(
      {
        type: "team.invite",
        organizationId: ids.org,
        name: "X",
        email: "nueva@example.com",
        role: "viewer",
        propertyIds: [],
      },
      "sql-team-house",
    ),
  ).rejects.toThrow();

  // Owner adds a front desk member found by email.
  await as(ids.user);
  await run(
    {
      type: "team.invite",
      organizationId: ids.org,
      name: "Nueva Persona",
      email: "Nueva@Example.com",
      role: "front_desk",
      propertyIds: [],
    },
    "sql-team-invite",
  );
  const team = (
    await db.query<{ team: Array<{ userId: string; name: string; role: string }> }>(
      "select public.pms_team($1) team",
      [ids.org],
    )
  ).rows[0].team;
  expect(team.find((m) => m.userId === invitee)).toMatchObject({
    name: "Nueva Persona",
    role: "front_desk",
  });

  // A manager edits lower ranks (accepting "<org>:<user>" ids) but cannot
  // grant admin or touch the owner.
  await as(ids.manager);
  await run(
    {
      type: "team.update",
      organizationId: ids.org,
      id: `${ids.org}:${invitee}`,
      role: "housekeeping",
      status: "active",
      propertyIds: [ids.prop],
    },
    "sql-team-manager-update",
  );
  await expect(
    run(
      {
        type: "team.update",
        organizationId: ids.org,
        id: invitee,
        role: "admin",
        status: "active",
        propertyIds: [],
      },
      "sql-team-manager-escalate",
    ),
  ).rejects.toThrow();
  await expect(
    run(
      {
        type: "team.remove",
        organizationId: ids.org,
        id: ids.user,
      },
      "sql-team-manager-owner",
    ),
  ).rejects.toThrow();
  await db.exec("reset role");
  expect(
    (
      await db.query(
        "select r.key,m.all_properties,(select count(*)::int from public.member_property_scopes s where s.user_id=m.user_id) scopes from public.organization_members m join public.roles r on r.id=m.role_id where m.user_id=$1",
        [invitee],
      )
    ).rows,
  ).toEqual([{ key: "housekeeping", all_properties: false, scopes: 1 }]);

  await as(ids.user);
  await run(
    { type: "team.remove", organizationId: ids.org, id: invitee },
    "sql-team-remove",
  );
  await db.exec("reset role");
  expect(
    (
      await db.query(
        "select count(*)::int n from public.organization_members where user_id=$1",
        [invitee],
      )
    ).rows,
  ).toEqual([{ n: 0 }]);
});
test("SQL property manager: houses, rooms, rental mode and safe deletion", async () => {
  const pm = "30000000-0000-0000-0000-0000000000f1";
  await db.exec(
    `reset role;insert into public.properties(id,organization_id,name,concept) values('${pm}','${ids.org}','Casa Gestor','boutique_hotel');insert into public.property_settings(organization_id,property_id) values('${ids.org}','${pm}');`,
  );
  await as(ids.user);
  const scope = { organizationId: ids.org, propertyId: pm };
  const run = async (command: Record<string, unknown>, key: string) =>
    (
      await db.query<{ r: { id: string } }>(
        "select public.pms_command($1::jsonb,$2) r",
        [JSON.stringify({ ...scope, ...command }), key],
      )
    ).rows[0].r;
  const room = (name: string, parentUnitId: string | null, key: string) =>
    run(
      { type: "room.create", name, parentUnitId, maxOccupancy: 2, baseRateMinor: 150000 },
      key,
    );
  await expect(
    run({ type: "property.rentalMode", mode: "rooms" }, "pm-mode-empty"),
  ).rejects.toThrow("RENTAL_MODE_NEEDS_ROOMS");
  const house = (await room("Casa", null, "pm-house")).id;
  const first = (await room("Cuarto 1", house, "pm-room-1")).id;
  const second = (await room("Cuarto 2", house, "pm-room-2")).id;
  await expect(room("Cuarto 1", house, "pm-room-dup")).rejects.toThrow("DUPLICATE_UNIT");
  const active = async () =>
    Object.fromEntries(
      (
        await db.query<{ name: string; active: boolean }>(
          "select u.name,t.active from public.units u join public.inventory_types t on t.id=u.inventory_type_id where u.property_id=$1",
          [pm],
        )
      ).rows.map((r) => [r.name, r.active]),
    );
  await run({ type: "property.rentalMode", mode: "whole" }, "pm-mode-whole");
  expect(await active()).toEqual({ Casa: true, "Cuarto 1": false, "Cuarto 2": false });
  await run({ type: "property.rentalMode", mode: "rooms" }, "pm-mode-rooms");
  expect(await active()).toEqual({ Casa: false, "Cuarto 1": true, "Cuarto 2": true });
  expect(
    (
      await db.query<{ mode: string }>(
        "select settings_json->>'rentalMode' mode from public.property_settings where property_id=$1",
        [pm],
      )
    ).rows,
  ).toEqual([{ mode: "rooms" }]);
  await run(
    {
      type: "room.update",
      id: first,
      name: "Cuarto Mar",
      maxOccupancy: 3,
      baseRateMinor: 210000,
      active: true,
      attributes: { bedrooms: 1, beds: 2, bathrooms: 1 },
      version: 1,
    },
    "pm-update",
  );
  expect(
    (
      await db.query(
        "select u.name,u.version::int,t.name type_name,t.max_occupancy,t.base_rate_minor::int rate,(select value_json from public.unit_attributes a where a.unit_id=u.id and a.key='beds') beds from public.units u join public.inventory_types t on t.id=u.inventory_type_id where u.id=$1",
        [first],
      )
    ).rows,
  ).toEqual([
    { name: "Cuarto Mar", version: 2, type_name: "Cuarto Mar", max_occupancy: 3, rate: 210000, beds: 2 },
  ]);
  await expect(
    run({ type: "room.delete", id: house, version: 1 }, "pm-delete-house"),
  ).rejects.toThrow("ROOM_HAS_ROOMS");
  await db.exec(
    `reset role;insert into public.reservations(id,organization_id,property_id,guest_id,confirmation_code,arrival_date,departure_date,adults,status,currency,total_minor) values('80000000-0000-0000-0000-0000000000f1','${ids.org}','${pm}','${ids.guest}','PM-1','2030-01-01','2030-01-03',1,'confirmed','MXN',0);insert into public.reservation_units(organization_id,property_id,reservation_id,inventory_type_id,unit_id,rate_plan_id,arrival_date,departure_date,guests_count) select '${ids.org}','${pm}','80000000-0000-0000-0000-0000000000f1',inventory_type_id,id,(select id from public.rate_plans where property_id='${pm}'),'2030-01-01','2030-01-03',1 from public.units where id='${first}';`,
  );
  await as(ids.user);
  await expect(
    run({ type: "room.delete", id: first, version: 2 }, "pm-delete-booked"),
  ).rejects.toThrow("ROOM_HAS_RESERVATIONS");
  await run({ type: "room.delete", id: second, version: 1 }, "pm-delete-free");
  expect(
    (
      await db.query<{ units: number; types: number }>(
        "select (select count(*)::int from public.units where property_id=$1) units,(select count(*)::int from public.inventory_types where property_id=$1) types",
        [pm],
      )
    ).rows,
  ).toEqual([{ units: 2, types: 2 }]);
  await as(ids.house);
  await expect(
    run({ type: "room.create", name: "Ajeno", parentUnitId: null, maxOccupancy: 1, baseRateMinor: 0 }, "pm-forbidden"),
  ).rejects.toThrow();
  await db.exec("reset role");
});

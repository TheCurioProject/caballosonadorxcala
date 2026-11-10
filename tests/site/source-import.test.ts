import { beforeAll, afterAll, test, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import {
  buildSmoobuPlan,
  CASA_UNITS,
} from "../../scripts/lib/lodging-source.mjs";
import { applyLodgingSource } from "../../scripts/lib/apply-lodging-source.mjs";
import { enrichSmoobu, messageText } from "../../scripts/lib/enrich-smoobu.mjs";
let db: PGlite;
let scope: { organizationId: string; defaultPropertyId: string };
const owner = "b2000000-0000-0000-0000-000000000001";
const source = {
  format: "casa-smoobu-readonly-v1",
  accountId: 1939851,
  apartments: CASA_UNITS.map((u) => ({
    id: u.sourceId,
    name: u.slug,
    details: {
      currency: "MXN",
      rooms: { maxOccupancy: u.kind === "whole_home" ? 12 : 2, bathrooms: 1 },
    },
  })),
  bookings: [
    {
      id: 101,
      guestId: 1,
      apartment: { id: 3577971 },
      arrival: "2034-01-01",
      departure: "2034-01-03",
      adults: 1,
      children: 1,
      price: "500.50",
      prepayment: "100.25",
      "prepayment-paid": "Yes",
      "price-paid": "No",
      type: "reservation",
      "guest-name": "Invitado sintético",
      email: "guest@example.test",
      phone: "555 000 0000",
      "created-at": "2033-12-01 12:30",
      notice: "Nota preservada",
    },
    {
      id: 102,
      apartment: { id: 3577976 },
      arrival: "2034-01-01",
      departure: "2034-01-03",
      type: "reservation",
      "is-blocked-booking": true,
    },
    {
      id: 103,
      guestId: 2,
      apartment: { id: 3577981 },
      arrival: "2034-01-01",
      departure: "2034-01-03",
      adults: 2,
      children: 0,
      price: "300",
      prepayment: 0,
      type: "cancellation",
      "guest-name": "Cancelación sintética",
    },
  ],
  rates: {
    data: Object.fromEntries(
      CASA_UNITS.map((u) => [
        u.sourceId,
        {
          "2034-01-01": { price: 100, min_length_of_stay: null, available: 1 },
          "2034-01-02": { price: 100, min_length_of_stay: null, available: 1 },
        },
      ]),
    ),
  },
};
const content = {
  house: {
    name: { es: "Casa completa", en: "Entire house" },
    description: { es: "Descripción original", en: "Original description" },
    beds: { es: "6 habitaciones", en: "6 rooms" },
  },
  rooms: Object.fromEntries(
    CASA_UNITS.filter((u) => u.photoRoom).map((u) => [
      u.photoRoom,
      {
        name: { es: "Habitación " + u.photoRoom, en: "Room " + u.photoRoom },
        description: { es: "Descripción original", en: "Original description" },
        beds: { es: "Cama original", en: "Original bed" },
      },
    ]),
  ),
  policy: { es: "Política original", en: "Original policy" },
};
const q = async <T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
) => (await db.query<T>(sql, params)).rows;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`,
  );
  for (const name of readdirSync("supabase/migrations")
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + name, "utf8"));
  await q("insert into auth.users values($1,$2)", [
    owner,
    "owner@example.test",
  ]);
  scope = (await q("select site.bootstrap_cala($1) as data", [owner]))[0]
    .data as typeof scope;
  await db.exec("begin");
  await applyLodgingSource(q, buildSmoobuPlan(source), scope, content);
  await db.exec("commit");
}, 60000);
afterAll(async () => {
  await db?.close();
});
test("all seven products, guest fields, original amounts, cancellations and physical blocks migrate together", async () => {
  expect(await q("select * from site.lodgings")).toHaveLength(7);
  expect(await q("select * from pms_private.smoobu_imports")).toHaveLength(3);
  expect(
    (
      await q(
        "select r.total_minor,r.children,r.status from public.reservations r where confirmation_code='SMO-101'",
      )
    )[0],
  ).toMatchObject({ total_minor: 50050, children: 1, status: "confirmed" });
  expect(
    (
      await q(
        "select status from public.reservations where confirmation_code='SMO-103'",
      )
    )[0].status,
  ).toBe("cancelled");
  const payment = (
    await q(
      "select provider,method_type,amount_minor from public.payments where provider='smoobu_import'",
    )
  )[0];
  expect(payment).toMatchObject({
    provider: "smoobu_import",
    method_type: "imported_unverified",
    amount_minor: 10025,
  });
  const ledger = (
    await q(
      "select original_payload from pms_private.smoobu_imports where external_id=101",
    )
  )[0].original_payload as Record<string, unknown>;
  expect(ledger.notice).toBe("Nota preservada");
  expect(ledger.phone).toBe("555 000 0000");
  expect(await q("select * from site.booking_lodging")).toHaveLength(2);
});
test("an identical retry preserves later CALA edits and cannot duplicate imported payments", async () => {
  await q(
    "update public.inventory_types set base_rate_minor=77777 where id=(select inventory_type_id from site.lodgings where source_apartment_id=3577971)",
  );
  await db.exec("begin");
  const result = await applyLodgingSource(
    q,
    buildSmoobuPlan(source),
    scope,
    content,
  );
  await db.exec("commit");
  expect(result.reused).toBe(3);
  expect(result.imported).toBe(0);
  expect(
    Number(
      (
        await q(
          "select base_rate_minor from public.inventory_types where id=(select inventory_type_id from site.lodgings where source_apartment_id=3577971)",
        )
      )[0].base_rate_minor,
    ),
  ).toBe(77777);
  expect(
    await q("select * from public.payments where provider='smoobu_import'"),
  ).toHaveLength(1);
});
test("a reviewed historical append adds only older stays and rejects changes to already imported records", async () => {
  const history = structuredClone(source);
  history.bookings.push({
    ...history.bookings[0],
    id: 104,
    arrival: "2033-01-01",
    departure: "2033-01-03",
  });
  await db.exec("begin");
  await expect(
    applyLodgingSource(q, buildSmoobuPlan(history), scope, content),
  ).rejects.toThrow(/SOURCE_CHANGED/);
  await db.exec("rollback;begin");
  const result = await applyLodgingSource(
    q,
    buildSmoobuPlan(history),
    scope,
    content,
    { allowHistoricalAppend: true },
  );
  await db.exec("commit");
  expect(result.imported).toBe(1);
  expect(result.reused).toBe(3);
  const unsafe = structuredClone(history);
  unsafe.bookings[0].price = "999";
  await db.exec("begin");
  await expect(
    applyLodgingSource(q, buildSmoobuPlan(unsafe), scope, content, {
      allowHistoricalAppend: true,
    }),
  ).rejects.toThrow(/EXISTING_SOURCE_RECORD_CHANGED/);
  await db.exec("rollback");
  expect(
    (
      await q<{ deposit_paid: number }>(
        'select deposit_paid from site.reservas where "externalId"=$1',
        ["SMOOBU-101"],
      )
    )[0].deposit_paid,
  ).toBe(100.25);
});
test("provider guest identities merge repeat stays and import conversations without sending messages", async () => {
  const history = structuredClone(source);
  history.bookings.push({
    ...history.bookings[0],
    id: 104,
    arrival: "2033-01-01",
    departure: "2033-01-03",
  });
  const profiles = {
    accountId: 1939851,
    guests: [
      {
        id: 1,
        firstName: "Ana",
        lastName: "Prueba",
        companyName: "Empresa de prueba",
        emails: ["ana@example.test"],
        telephoneNumbers: ["+523331234567"],
        address: {
          street: "Calle de prueba",
          city: "Chacala",
          postalCode: "00000",
          country: "MX",
        },
        notes: "Nota del perfil original",
        bookings: [],
      },
      {
        id: 2,
        firstName: "Invitado",
        lastName: "Cancelado",
        emails: [],
        telephoneNumbers: [],
        address: {},
        bookings: [],
      },
    ],
  };
  const conversations = {
    accountId: 1939851,
    conversations: [
      {
        thread: { booking: { id: 101 } },
        messages: [
          {
            id: 1,
            type: 1,
            subject: "Consulta",
            message: "Mensaje recibido",
            createdAt: "2033-12-01 12:30",
          },
          {
            id: 2,
            type: 2,
            subject: "Respuesta",
            htmlMessage:
              "<p>Respuesta<br>original<script>ignored()</script></p>",
            createdAt: "2033-12-01 12:31",
          },
        ],
      },
    ],
  };
  await db.exec("begin");
  const result = await enrichSmoobu(
    q,
    history,
    profiles,
    conversations,
    scope,
    owner,
  );
  await db.exec("commit");
  expect(result).toEqual({
    profilesImported: 2,
    duplicatesMerged: 1,
    messagesImported: 2,
  });
  expect(await q("select * from public.guests")).toHaveLength(2);
  const links = await q<{ guest_id: string }>(
    "select guest_id from public.reservations where confirmation_code in('SMO-101','SMO-104')",
  );
  expect(links[0].guest_id).toBe(links[1].guest_id);
  expect(
    (
      await q(
        "select company,address from public.guests where first_name='Ana'",
      )
    )[0],
  ).toMatchObject({ company: "Empresa de prueba", address: "Calle de prueba" });
  expect(
    (
      await q<{ status: string }>(
        "select status from public.message_entries order by created_at",
      )
    ).map((r) => r.status),
  ).toEqual(["received", "recorded"]);
  expect(messageText(conversations.conversations[0].messages[1])).toBe(
    "Respuesta\noriginal",
  );
  await db.exec("begin");
  const retry = await enrichSmoobu(
    q,
    history,
    profiles,
    conversations,
    scope,
    owner,
  );
  await db.exec("commit");
  expect(retry).toEqual({
    profilesImported: 0,
    duplicatesMerged: 0,
    messagesImported: 0,
  });
});

import { test, expect } from "vitest";
import { LocalPersistenceAdapter } from "@/cala/infrastructure/persistence/local";
import { seedState } from "../fixtures/seed";
import { ApplicationService } from "@/cala/application/service";
import { priceStay } from "@/cala/domain/reservations/pricing";
import { DevelopmentAuthAdapter } from "@/cala/infrastructure/auth/development";
const actor = {
    userId: "user-owner",
    stepUpUntil: new Date(Date.now() + 300000).toISOString(),
  },
  base = { organizationId: "org-estancia", propertyId: "property-hotel" };
function setup() {
  const store = new LocalPersistenceAdapter(":memory:", seedState);
  return { store, app: new ApplicationService(store) };
}
test("property setup persists its IANA timezone and curated amenities", () => {
  const { store, app } = setup();
  const created = app.execute(
    actor,
    {
      type: "property.create",
      organizationId: base.organizationId,
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
      amenities: ["wifi", "pool", "self_check_in"],
      checkIn: "15:00",
      checkOut: "11:00",
      policy: "Política de prueba",
      taxBps: 0,
    },
    "property-options",
  );
  expect(
    store.read().properties.find((p) => p.id === created.id)?.timezone,
  ).toBe("America/Bogota");
  expect(
    store.read().inventoryTypes.find((type) => type.propertyId === created.id)
      ?.amenities,
  ).toEqual(["Wi-Fi", "Alberca", "Auto check-in"]);
  store.close();
});
test("rates update is atomic on stale preview; nightly restrictions and exact taxes are enforced", () => {
  const { store, app } = setup();
  const rate = {
    ...base,
    type: "rates.bulk",
    inventoryTypeId: "type-hotel",
    ratePlanId: "plan-hotel",
    arrival: "2030-01-01",
    departure: "2030-01-03",
    amountMinor: 10029,
    minStay: 2,
    maxStay: 5,
    closed: false,
    cta: false,
    ctd: false,
    expectedVersions: { "2030-01-01": 0, "2030-01-02": 0 },
  };
  app.execute(actor, rate, "rates-first");
  expect(() =>
    app.execute(
      actor,
      {
        ...rate,
        amountMinor: 20000,
        expectedVersions: { "2030-01-01": 1, "2030-01-02": 0 },
      },
      "rates-stale",
    ),
  ).toThrow(/actualizó/);
  expect(
    store.read().rateDays.filter((d) => d.date === "2030-01-01")[0].amountMinor,
  ).toBe(10029);
  expect(() =>
    priceStay(
      store.read(),
      base.propertyId,
      "type-hotel",
      "plan-hotel",
      "2030-01-01",
      "2030-01-02",
    ),
  ).toThrow(/mínimo/);
  store.transaction((s) => {
    s.properties.find((p) => p.id === base.propertyId)!.taxBps = 1600;
  });
  expect(
    priceStay(
      store.read(),
      base.propertyId,
      "type-hotel",
      "plan-hotel",
      "2030-01-01",
      "2030-01-03",
    ).totalMinor,
  ).toBe(23267);
  store.close();
});
test("maintenance completion, housekeeping and suspended session revoke are durable mutations", () => {
  const { store, app } = setup();
  const auth = new DevelopmentAuthAdapter(store);
  const token = auth.signIn("user-housekeeping");
  expect(auth.resolve(token)?.userId).toBe("user-housekeeping");
  const t = app.execute(
    actor,
    {
      ...base,
      type: "task.save",
      kind: "housekeeping",
      unitId: "unit-hotel-1",
      title: "Preparar habitación",
      status: "pending",
      priority: "high",
      assigneeId: "user-housekeeping",
    },
    "task-create",
  );
  app.execute(
    actor,
    {
      ...base,
      type: "task.save",
      id: t.id,
      version: 1,
      kind: "housekeeping",
      unitId: "unit-hotel-1",
      title: "Preparar habitación",
      status: "completed",
      priority: "high",
      assigneeId: "user-housekeeping",
    },
    "task-complete",
  );
  expect(
    store.read().units.find((u) => u.id === "unit-hotel-1")?.housekeeping,
  ).toBe("clean");
  const m = store
    .read()
    .memberships.find((m) => m.userId === "user-housekeeping")!;
  app.execute(
    actor,
    {
      organizationId: base.organizationId,
      type: "team.update",
      id: m.id,
      role: m.role,
      status: "suspended",
      propertyIds: m.propertyIds,
    },
    "member-suspend",
  );
  expect(auth.resolve(token)).toBe(null);
  store.close();
});
test("admin cannot grant admin, and auth throttling rejects excess requests", () => {
  const { store, app } = setup();
  expect(() =>
    app.execute(
      { ...actor, userId: "user-admin" },
      {
        type: "team.invite",
        organizationId: base.organizationId,
        name: "Nueva cuenta",
        email: "test@example.test",
        role: "admin",
        propertyIds: [],
      },
      "admin-invite",
    ),
  ).toThrow(/propietario/);
  store.limit("test", 1);
  expect(() => store.limit("test", 1)).toThrow(/solicitudes/);
  store.close();
});

test("cached idempotency results still require current permission", () => {
  const { store, app } = setup();
  const cmd = { ...base, type: "ical.rotate", unitId: "unit-hotel-1" };
  app.execute(actor, cmd, "revoked-feed");
  store.transaction((s) => {
    s.memberships.find(
      (m) =>
        m.userId === actor.userId && m.organizationId === base.organizationId,
    )!.role = "viewer";
  });
  expect(() => app.execute(actor, cmd, "revoked-feed")).toThrow(/rol/);
  store.close();
});

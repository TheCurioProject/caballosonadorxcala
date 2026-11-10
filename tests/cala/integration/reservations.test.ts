import { test, expect } from "vitest";
import { LocalPersistenceAdapter } from "@/cala/infrastructure/persistence/local";
import { seedState } from "../fixtures/seed";
import { ApplicationService } from "@/cala/application/service";
import { today, addDays } from "@/cala/domain/shared/dates";
import { snapshot } from "@/cala/application/queries";
const actor = {
  userId: "user-owner",
  stepUpUntil: new Date(Date.now() + 300000).toISOString(),
};
function setup() {
  const store = new LocalPersistenceAdapter(":memory:", seedState);
  return {
    store,
    app: new ApplicationService(store),
  };
}
const reservation = {
  type: "reservation.save",
  organizationId: "org-estancia",
  propertyId: "property-hotel",
  guestId: "guest-1",
  inventoryTypeId: "type-hotel",
  unitId: "unit-hotel-1",
  ratePlanId: "plan-hotel",
  arrival: addDays(today(), 30),
  departure: addDays(today(), 33),
  adults: 2,
  children: 0,
  notes: "",
  status: "confirmed",
};
test("atomic reservation, conflict, idempotency, cancellation releases once", () => {
  const { store, app } = setup();
  const first = app.execute(actor, reservation, "key-first");
  expect(app.execute(actor, reservation, "key-first")).toEqual(first);
  expect(() => app.execute(actor, reservation, "key-other")).toThrow(/ocupado/);
  expect(
    store.read().reservations.filter((r) => r.id === first.id),
  ).toHaveLength(1);
  const cancel = {
    type: "reservation.transition",
    organizationId: "org-estancia",
    propertyId: "property-hotel",
    id: first.id,
    status: "cancelled",
    version: 1,
  };
  app.execute(actor, cancel, "key-cancel");
  app.execute(actor, cancel, "key-cancel");
  expect(() => app.execute(actor, reservation, "key-third")).not.toThrow();
  store.close();
});
test("whole dorm conflicts with occupied bed", () => {
  const { store, app } = setup();
  expect(() =>
    app.execute(
      actor,
      {
        ...reservation,
        propertyId: "property-hostel",
        inventoryTypeId: "type-dorm",
        unitId: "unit-dorm",
        ratePlanId: "plan-hostel",
        arrival: today(),
        departure: addDays(today(), 2),
      },
      "dorm-key",
    ),
  ).toThrow(/ocupado|disponibilidad/);
  store.close();
});
test("tenant and financial data are redacted for housekeeping", () => {
  const { store, app } = setup();
  const actor = { userId: "user-housekeeping", stepUpUntil: null };
  const view = snapshot(store.read(), actor);
  expect(view.guests).toHaveLength(0);
  expect(view.payments).toHaveLength(0);
  expect(view.properties.some((p) => p.organizationId === "org-other")).toBe(
    false,
  );
  expect(() => app.execute(actor, reservation, "denied-key")).toThrow();
  store.close();
});
test("stale edit and reused idempotency key rejected", () => {
  const { store, app } = setup();
  const r = app.execute(actor, reservation, "key-save");
  expect(() =>
    app.execute(actor, { ...reservation, notes: "changed" }, "key-save"),
  ).toThrow(/clave/);
  expect(() =>
    app.execute(actor, { ...reservation, id: r.id, version: 0 }, "key-edit"),
  ).toThrow();
  store.close();
});
test("blocking the last unit respects existing unassigned reservations", () => {
  const { store, app } = setup();
  app.execute(
    actor,
    {
      ...reservation,
      propertyId: "property-home",
      inventoryTypeId: "type-home",
      ratePlanId: "plan-home",
      unitId: null,
    },
    "unassigned-home",
  );
  expect(() =>
    app.execute(
      actor,
      {
        type: "block.create",
        organizationId: "org-estancia",
        propertyId: "property-home",
        unitId: "unit-home-1",
        arrival: reservation.arrival,
        departure: reservation.departure,
        reason: "Maintenance",
      },
      "blocking-home",
    ),
  ).toThrow(/disponibilidad/);
  expect(store.read().blocks.some((b) => b.reason === "Maintenance")).toBe(
    false,
  );
  store.close();
});

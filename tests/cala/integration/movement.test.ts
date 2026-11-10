import { test, expect } from "vitest";
import { seedState } from "../fixtures/seed";
import { LocalPersistenceAdapter } from "@/cala/infrastructure/persistence/local";
import { ApplicationService } from "@/cala/application/service";
import { addDays, today } from "@/cala/domain/shared/dates";
import { shiftedArrival } from "@/cala/domain/reservations/movement";
const actor = { userId: "user-owner", stepUpUntil: null };
const start = addDays(today(), 90);
function setup() {
  const store = new LocalPersistenceAdapter(":memory:", seedState),
    app = new ApplicationService(store);
  const created = app.execute(
    actor,
    {
      type: "reservation.save",
      organizationId: "org-estancia",
      propertyId: "property-hotel",
      guestId: "guest-1",
      inventoryTypeId: "type-hotel",
      unitId: "unit-hotel-1",
      ratePlanId: "plan-hotel",
      arrival: start,
      departure: addDays(start, 3),
      adults: 2,
      children: 0,
      notes: "nota original",
      status: "confirmed",
    },
    "create-move-reservation",
  );
  store.transaction((s) => {
    const r = s.reservations.find((r) => r.id === created.id)!;
    r.source = "booking.com";
    s.payments.push({
      id: "paid",
      propertyId: r.propertyId,
      reservationId: r.id,
      amountMinor: 20000,
      provider: "manual",
      externalId: "external-payment",
      status: "succeeded",
      createdAt: new Date().toISOString(),
    });
  });
  const target = store
    .read()
    .units.find(
      (u) => u.propertyId === "property-hotel" && u.id !== "unit-hotel-1",
    )!;
  const move = {
    type: "reservation.move",
    organizationId: "org-estancia",
    propertyId: "property-hotel",
    id: created.id,
    version: 1,
    unitId: target.id,
    arrival: start,
    departure: addDays(start, 3),
    pricing: "preserve",
  };
  return { store, app, move, target };
}
test("moving preserves dates, agreed price, guest, channel and payments; retry emits once", () => {
  const { store, app, move } = setup();
  const before = store.read().reservations.find((r) => r.id === move.id)!;
  const response = app.execute(actor, move, "move-preserved");
  expect(app.execute(actor, move, "move-preserved")).toEqual(response);
  const state = store.read(),
    after = state.reservations.find((r) => r.id === move.id)!;
  expect(after).toEqual({ ...before, unitId: move.unitId, version: 2 });
  expect(state.payments.find((p) => p.id === "paid")?.amountMinor).toBe(20000);
  expect(
    state.audits.filter((a) => a.action === "reservation.move"),
  ).toHaveLength(1);
  store.close();
});
test("stale moves and a destination occupied on the last night roll back completely", () => {
  const { store, app, move } = setup();
  store.transaction((s) => {
    const r = s.reservations.find((r) => r.id === move.id)!;
    s.reservations.push({
      ...r,
      id: "conflicting",
      unitId: move.unitId,
      arrival: addDays(start, 2),
      departure: addDays(start, 4),
    });
  });
  expect(() => app.execute(actor, move, "move-conflict")).toThrow(
    /ocupado|disponibilidad/,
  );
  expect(store.read().reservations.find((r) => r.id === move.id)?.version).toBe(
    1,
  );
  expect(() =>
    app.execute(actor, { ...move, version: 999 }, "move-stale"),
  ).toThrow(/actualizó/);
  store.close();
});
test("cross-property move is denied and a checked-in move marks the old unit dirty", () => {
  const { store, app, move, target } = setup();
  expect(() =>
    app.execute(
      actor,
      { ...move, unitId: "unit-home-1" },
      "move-cross-property",
    ),
  ).toThrow(/propiedad/);
  store.transaction((s) => {
    s.reservations.find((r) => r.id === move.id)!.status = "checked_in";
    s.units.find((u) => u.id === target.id)!.housekeeping = "dirty";
  });
  expect(() => app.execute(actor, move, "move-dirty")).toThrow(/limpieza/);
  store.transaction((s) => {
    s.units.find((u) => u.id === target.id)!.housekeeping = "clean";
  });
  expect(() =>
    app.execute(
      actor,
      { ...move, arrival: addDays(start, 1) },
      "move-inhouse-dates",
    ),
  ).toThrow(/fechas/);
  app.execute(actor, move, "move-inhouse");
  expect(
    store.read().units.find((u) => u.id === "unit-hotel-1")?.housekeeping,
  ).toBe("dirty");
  store.close();
});
test("dragging from the middle preserves the pointer anchor even across DST", () => {
  expect(shiftedArrival("2026-10-30", "2026-11-01", "2026-11-03")).toBe(
    "2026-11-01",
  );
});

test("explicit repricing changes only the room charge and preserves extra charges and payments", () => {
  const { store, app, move } = setup();
  app.execute(
    actor,
    {
      type: "folio.charge",
      organizationId: move.organizationId,
      propertyId: move.propertyId,
      reservationId: move.id,
      description: "Extra intacto",
      amountMinor: 12345,
    },
    "move-extra-charge",
  );
  app.execute(
    actor,
    {
      type: "rates.bulk",
      organizationId: move.organizationId,
      propertyId: move.propertyId,
      ratePlanId: "plan-hotel",
      inventoryTypeId: "type-hotel",
      arrival: start,
      departure: addDays(start, 3),
      amountMinor: 200000,
      minStay: 1,
      maxStay: 730,
      closed: false,
      cta: false,
      ctd: false,
      expectedVersions: {},
    },
    "move-new-rate",
  );
  app.execute(actor, { ...move, pricing: "recalculate" }, "move-recalculate");
  const state = store.read(),
    r = state.reservations.find((r) => r.id === move.id)!;
  const taxBps = state.properties.find((p) => p.id === move.propertyId)!.taxBps;
  const expected = 600000 + Number((600000n * BigInt(taxBps) + 5000n) / 10000n);
  expect(r.totalMinor).toBe(expected);
  expect(
    state.folioItems.find((i) => i.reservationId === r.id && i.kind === "room")
      ?.amountMinor,
  ).toBe(expected);
  expect(
    state.folioItems.find(
      (i) => i.reservationId === r.id && i.description === "Extra intacto",
    )?.amountMinor,
  ).toBe(12345);
  expect(state.payments.find((p) => p.id === "paid")?.amountMinor).toBe(20000);
  store.close();
});

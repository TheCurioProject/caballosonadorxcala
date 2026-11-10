import { test, expect } from "vitest";
import { seedState } from "../fixtures/seed";
import { LocalPersistenceAdapter } from "@/cala/infrastructure/persistence/local";
import { ApplicationService } from "@/cala/application/service";
import { snapshot } from "@/cala/application/queries";
import { renderMessage, validateTemplate } from "@/cala/domain/messaging/templates";
const actor = { userId: "user-owner", stepUpUntil: null };
function setup() {
  const store = new LocalPersistenceAdapter(":memory:", seedState);
  return { store, app: new ApplicationService(store) };
}
test("draft, note and outgoing preparation persist honestly without delivery or duplicate messages", () => {
  const { store, app } = setup(),
    r = store
      .read()
      .reservations.find(
        (r) => r.propertyId === "property-hotel" && r.status !== "cancelled",
      )!;
  const input = {
    type: "message.save",
    organizationId: r.organizationId,
    propertyId: r.propertyId,
    reservationId: r.id,
    body: "Texto de prueba",
    subject: "",
    mode: "draft",
    scheduledAt: null,
  };
  const created = app.execute(actor, input, "draft-message");
  app.execute(actor, input, "draft-message");
  expect(store.read().messageEntries).toHaveLength(1);
  app.execute(
    actor,
    { ...input, id: created.id, version: 1, mode: "prepare" },
    "prepare-message",
  );
  expect(store.read().messageEntries[0].status).toBe("blocked");
  expect(store.read().messageEntries[0].failureCode).toBe(
    "MESSAGING_PROVIDER_NOT_CONFIGURED",
  );
  expect(() =>
    app.execute(
      actor,
      { ...input, id: created.id, version: 1 },
      "stale-message",
    ),
  ).toThrow();
  app.execute(actor, { ...input, mode: "note" }, "internal-note");
  expect(store.read().messageEntries[1].status).toBe("recorded");
  expect(
    snapshot(store.read(), { userId: "user-housekeeping", stepUpUntil: null })
      .messageEntries,
  ).toEqual([]);
  expect(
    snapshot(store.read(), { userId: "user-finance", stepUpUntil: null })
      .messageEntries,
  ).toEqual([]);
  expect(() =>
    app.execute(
      { userId: "user-other", stepUpUntil: null },
      input,
      "tenant-message-denied",
    ),
  ).toThrow();
  expect(
    store.read().audits.some((a) => a.detail.includes("Texto de prueba")),
  ).toBe(false);
  store.close();
});
test("template variables are plain text, validated and do not recursively expand guest content", () => {
  const s = seedState(),
    r = s.reservations[0],
    property = s.properties.find((p) => p.id === r.propertyId)!,
    guest = { ...s.guests[0], firstName: "{{check_in}} <script>" };
  expect(
    renderMessage("Hola {{guest_first_name}} · {{property_name}}", {
      reservation: r,
      property,
      guest,
    }),
  ).toBe(`Hola {{check_in}} <script> · ${property.name}`);
  expect(() => validateTemplate("Hola {{unknown}}")).toThrow(/desconocida/);
  expect(() => validateTemplate("Hola {{guest_first_name")).toThrow(/llaves/);
});
test("market import is atomic, idempotent, tenant scoped and rejects foreign currencies", () => {
  const { store, app } = setup();
  const row = {
    date: "2027-01-01",
    observedOn: "2026-01-01",
    source: "licensed",
    market: "Centro",
    currency: "MXN",
    adrMinor: 125000,
    occupancyBps: 6500,
    sampleSize: 20,
  };
  const input = {
    type: "market.import",
    organizationId: "org-estancia",
    propertyId: "property-hotel",
    rows: [row],
  };
  app.execute(actor, input, "market-first");
  app.execute(actor, input, "market-first");
  expect(store.read().marketObservations).toHaveLength(1);
  app.execute(
    actor,
    { ...input, rows: [{ ...row, adrMinor: 135000 }] },
    "market-update",
  );
  expect(store.read().marketObservations[0].adrMinor).toBe(135000);
  expect(() =>
    app.execute(
      actor,
      {
        ...input,
        rows: [
          { ...row, date: "2027-01-02" },
          { ...row, currency: "USD" },
        ],
      },
      "market-batch-reject",
    ),
  ).toThrow(/moneda/);
  expect(store.read().marketObservations).toHaveLength(1);
  expect(
    snapshot(store.read(), { userId: "user-housekeeping", stepUpUntil: null })
      .marketObservations,
  ).toEqual([]);
  store.close();
});

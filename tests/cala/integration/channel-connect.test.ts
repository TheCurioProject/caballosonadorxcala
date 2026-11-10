import { test, expect } from "vitest";
import { LocalPersistenceAdapter } from "@/cala/infrastructure/persistence/local";
import { ApplicationService } from "@/cala/application/service";
import { seedState } from "../fixtures/seed";
import { providerForSource } from "@/cala/domain/messaging/ota";
import { monthDays } from "@/cala/features/reservations/calendar-shared";

const actor = { userId: "user-owner", stepUpUntil: null };
const base = { organizationId: "org-estancia", propertyId: "property-hotel" };

function setup() {
  const store = new LocalPersistenceAdapter(":memory:", seedState);
  return { store, service: new ApplicationService(store) };
}
function mapping(store: LocalPersistenceAdapter, externalId: string) {
  const s = store.read();
  const type = s.inventoryTypes.find((t) => t.propertyId === base.propertyId)!;
  const plan = s.ratePlans.find((p) => p.propertyId === base.propertyId)!;
  return { inventoryTypeId: type.id, ratePlanId: plan.id, externalId };
}

test("connection assistant registers an OTA, reconnects in place and disconnects", () => {
  const { store, service } = setup();
  const first = service.execute(
    actor,
    {
      ...base,
      type: "channel.connect",
      provider: "airbnb",
      name: "Airbnb · host@example.com",
      syncMode: "all",
      ownership: "pms",
      mappings: [mapping(store, "53812749")],
    },
    "connect-airbnb-1",
  );
  let channel = store.read().channels.find((c) => c.id === first.id)!;
  expect(channel).toMatchObject({
    provider: "airbnb",
    status: "connected",
    lastSync: null,
    version: 1,
  });
  expect(channel.mappings).toHaveLength(1);

  // Running the assistant again for the same OTA updates the same connection.
  const again = service.execute(
    actor,
    {
      ...base,
      type: "channel.connect",
      provider: "airbnb",
      name: "Airbnb · other@example.com",
      syncMode: "ari",
      ownership: "channel",
      mappings: [mapping(store, "99999999")],
    },
    "connect-airbnb-2",
  );
  expect(again.id).toBe(first.id);
  channel = store.read().channels.find((c) => c.id === first.id)!;
  expect(channel).toMatchObject({ syncMode: "ari", version: 2 });
  expect(channel.mappings[0].externalId).toBe("99999999");

  service.execute(
    actor,
    { ...base, type: "channel.disconnect", id: first.id, version: 2 },
    "disconnect-airbnb",
  );
  expect(store.read().channels.find((c) => c.id === first.id)?.status).toBe(
    "disconnected",
  );
});

test("connection assistant rejects duplicate listing ids", () => {
  const { store, service } = setup();
  const m = mapping(store, "123456");
  expect(() =>
    service.execute(
      actor,
      {
        ...base,
        type: "channel.connect",
        provider: "booking",
        name: "Booking.com · 8123456",
        syncMode: "all",
        ownership: "pms",
        mappings: [m, { ...m }],
      },
      "connect-dup",
    ),
  ).toThrow();
});

test("reservation sources map to OTA providers", () => {
  expect(providerForSource("Airbnb")).toBe("airbnb");
  expect(providerForSource("booking.com")).toBe("booking");
  expect(providerForSource("ical:Vrbo")).toBe("vrbo");
  expect(providerForSource("direct")).toBeNull();
});

test("the month planner always spans the whole month", () => {
  expect(monthDays("2028-02-15")).toHaveLength(29);
  expect(monthDays("2026-11-09")[0]).toBe("2026-11-01");
  expect(monthDays("2026-11-09").at(-1)).toBe("2026-11-30");
  expect(monthDays("2026-12-31")).toHaveLength(31);
});

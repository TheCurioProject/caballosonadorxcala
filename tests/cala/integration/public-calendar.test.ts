import { test, expect } from "vitest";
import { LocalPersistenceAdapter } from "@/cala/infrastructure/persistence/local";
import { ApplicationService } from "@/cala/application/service";
import { readPublicCalendar } from "@/cala/application/public-calendar";
import { seedState } from "../fixtures/seed";
import { addDays, today } from "@/cala/domain/shared/dates";

const actor = { userId: "user-owner", stepUpUntil: null };
const base = {
  organizationId: "org-estancia",
  propertyId: "property-hotel",
  unitId: "unit-hotel-1",
};
test("public calendar returns only availability and revokes on rotation, access loss and unit deactivation", () => {
  const store = new LocalPersistenceAdapter(":memory:", seedState),
    app = new ApplicationService(store);
  const rotate = (key: string) =>
    new URL(
      app.execute(actor, { ...base, type: "ical.rotate" }, key).secretUrl!,
      "http://localhost",
    ).searchParams.get("token")!;
  try {
    const token = rotate("public-first");
    const calendar = readPublicCalendar(store.read(), token);
    expect(Object.keys(calendar).sort()).toEqual([
      "coverageEnd",
      "coverageStart",
      "events",
      "today",
    ]);
    expect(calendar.events.length).toBeGreaterThan(0);
    for (const event of calendar.events) {
      expect(Object.keys(event).sort()).toEqual([
        "arrival",
        "cancelled",
        "departure",
        "exportable",
        "sequence",
        "uid",
      ]);
      expect(event.uid).toMatch(/^[a-f0-9]{64}@cala\.local$/);
    }
    const serialized = JSON.stringify(calendar);
    for (const privateValue of [
      base.unitId,
      "reservation-",
      "guest-",
      "@example.test",
      store.read().properties[0].address,
    ])
      expect(serialized).not.toContain(privateValue);
    const replacement = rotate("public-rotate");
    expect(() => readPublicCalendar(store.read(), token)).toThrow(
      "Enlace no disponible",
    );
    store.transaction((s) => {
      s.memberships.find((m) => m.userId === actor.userId)!.status =
        "suspended";
    });
    expect(() => readPublicCalendar(store.read(), replacement)).toThrow(
      "Enlace no disponible",
    );
    store.transaction((s) => {
      s.memberships.find((m) => m.userId === actor.userId)!.status = "active";
      s.units.find((u) => u.id === base.unitId)!.active = false;
    });
    expect(() => readPublicCalendar(store.read(), replacement)).toThrow(
      "Enlace no disponible",
    );
  } finally {
    store.close();
  }
});

test("unassigned and imported occupancy stays visible without exporting imported blocks back into iCal", () => {
  const store = new LocalPersistenceAdapter(":memory:", seedState),
    app = new ApplicationService(store);
  try {
    const response = app.execute(
      actor,
      { ...base, type: "ical.rotate" },
      "public-coverage",
    );
    const token = new URL(
      response.secretUrl!,
      "http://localhost",
    ).searchParams.get("token")!;
    const day = addDays(today(), 60);
    store.transaction((s) => {
      s.reservations = [
        {
          ...s.reservations[0],
          id: "unassigned-private",
          propertyId: base.propertyId,
          inventoryTypeId: "type-hotel",
          unitId: null,
          arrival: day,
          departure: addDays(day, 2),
          status: "confirmed",
        },
      ];
      s.blocks = [
        {
          id: "imported-private",
          propertyId: base.propertyId,
          unitId: base.unitId,
          arrival: addDays(day, 4),
          departure: addDays(day, 5),
          reason: "Private maintenance detail",
          active: true,
        },
      ];
      s.icalEvents = [
        {
          ...base,
          calendar: "Private calendar",
          uid: "external",
          sequence: 1,
          stamp: "",
          blockId: "imported-private",
        },
      ];
    });
    const calendar = readPublicCalendar(store.read(), token);
    expect(calendar.events).toHaveLength(2);
    expect(calendar.events.find((e) => e.arrival === day)).toMatchObject({
      cancelled: false,
      exportable: true,
    });
    expect(
      calendar.events.find((e) => e.arrival === addDays(day, 4)),
    ).toMatchObject({ cancelled: false, exportable: false });
    expect(JSON.stringify(calendar)).not.toContain("Private");
    app.execute(actor, { ...base, type: "ical.revoke" }, "public-revoke");
    expect(() => readPublicCalendar(store.read(), token)).toThrow(
      "Enlace no disponible",
    );
  } finally {
    store.close();
  }
});

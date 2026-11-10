import { test, expect } from "vitest";
import { seedState } from "../fixtures/seed";
import {
  selectionRange,
  unitOccupancy,
  monthGrid,
  shiftMonth,
} from "@/cala/domain/calendar/layout";
test("calendar selection includes both cells and keeps checkout exclusive in either direction", () => {
  expect(selectionRange("2028-02-28", "2028-03-01")).toEqual({
    arrival: "2028-02-28",
    departure: "2028-03-02",
  });
  expect(selectionRange("2028-03-01", "2028-02-28")).toEqual(
    selectionRange("2028-02-28", "2028-03-01"),
  );
  expect(selectionRange("2026-12-31", "2026-12-31")).toEqual({
    arrival: "2026-12-31",
    departure: "2027-01-01",
  });
  expect(() => selectionRange("2027-02-29", "2027-03-01")).toThrow();
  expect(monthGrid("2028-02-01")).toHaveLength(42);
  expect(shiftMonth("2028-02-29", 12)).toBe("2029-02-01");
});
test("occupancy keeps hidden-channel stays and related resources unavailable until exclusive departure", () => {
  const s = seedState(),
    original = s.reservations[0];
  const unit = s.units.find(
    (u) => u.propertyId === original.propertyId && u.active,
  )!;
  s.reservations = [
    {
      ...original,
      unitId: unit.id,
      arrival: "2027-01-01",
      departure: "2027-01-04",
      status: "confirmed",
      source: "hidden-ota",
    },
  ];
  s.blocks = [];
  expect(
    unitOccupancy(s, unit.id, "2027-01-02", "2027-01-03").reservations,
  ).toHaveLength(1);
  expect(
    unitOccupancy(s, unit.id, "2027-01-04", "2027-01-05").reservations,
  ).toEqual([]);
  s.blocks = [
    {
      id: "blocked-test",
      propertyId: unit.propertyId,
      unitId: unit.id,
      arrival: "2027-01-05",
      departure: "2027-01-06",
      reason: "Prueba",
      active: true,
    },
  ];
  expect(
    unitOccupancy(s, unit.id, "2027-01-05", "2027-01-06").blocks,
  ).toHaveLength(1);
  expect(unitOccupancy(s, unit.id, "2027-01-06", "2027-01-07").blocks).toEqual(
    [],
  );
});

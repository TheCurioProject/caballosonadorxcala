import { test, expect } from "vitest";
import { seedState } from "../fixtures/seed";
import {
  allocatedRevenue,
  performance,
  performanceCsv,
} from "@/cala/domain/analytics/performance";
import {
  marketCsvHeader,
  parseMarketCsv,
  marketSummary,
} from "@/cala/domain/analytics/market";
test("cancellation distributions include channels with no surviving booking and handle empty cohorts", () => {
  const s = seedState(),
    r = s.reservations.find((r) => r.propertyId === "property-hotel")!;
  s.reservations = [
    {
      ...r,
      id: "cancelled-only-channel",
      arrival: "2027-01-01",
      departure: "2027-01-03",
      source: "cancelled-ota",
      status: "cancelled",
    },
  ];
  s.blocks = [];
  const report = performance(s, {
    propertyId: r.propertyId,
    start: "2027-01-01",
    end: "2027-01-04",
  });
  expect(report.channels).toEqual([]);
  expect(report.cancellationsByChannel).toEqual([
    { source: "cancelled-ota", count: 1 },
  ]);
  expect(report.cancellationRate).toBe(1);
  expect(
    performance(s, {
      propertyId: r.propertyId,
      start: "2028-01-01",
      end: "2028-01-02",
    }).cancellationsByChannel,
  ).toEqual([]);
});
function state() {
  const s = seedState();
  s.reservations = [];
  s.blocks = [];
  return s;
}
test("stay revenue is allocated exactly across periods, cancelled and pending excluded by default", () => {
  const s = state();
  const original = seedState().reservations.find(
    (r) => r.propertyId === "property-hotel",
  )!;
  s.reservations = [
    {
      ...original,
      id: "cross-month",
      arrival: "2027-01-30",
      departure: "2027-02-02",
      totalMinor: 100,
      status: "confirmed",
    },
    {
      ...original,
      id: "cancelled",
      arrival: "2027-01-30",
      departure: "2027-02-02",
      totalMinor: 9999,
      status: "cancelled",
    },
  ];
  const jan = performance(s, {
    propertyId: "property-hotel",
    start: "2027-01-30",
    end: "2027-02-01",
  });
  const feb = performance(s, {
    propertyId: "property-hotel",
    start: "2027-02-01",
    end: "2027-02-02",
  });
  expect(jan.roomRevenueMinor).toBe(67);
  expect(feb.roomRevenueMinor).toBe(33);
  expect(jan.roomRevenueMinor + feb.roomRevenueMinor).toBe(100);
  expect(jan.sold).toBe(2);
  expect(jan.cancellations).toBe(1);
  expect(jan.cancellationRate).toBe(0.5);
  expect([0, 1, 2].map((i) => allocatedRevenue(100, 3, i))).toEqual([
    34, 33, 33,
  ]);
  expect(performanceCsv(jan, "MXN", false)).not.toContain("centavos");
});
test("resource occupancy counts a dorm once per bed and keeps physical vs sellable denominators distinct", () => {
  const s = state(),
    original = seedState().reservations[0];
  s.reservations = [
    {
      ...original,
      id: "room",
      propertyId: "property-hostel",
      inventoryTypeId: "type-dorm",
      unitId: "unit-dorm",
      arrival: "2027-01-01",
      departure: "2027-01-02",
      status: "confirmed",
      totalMinor: 1001,
    },
  ];
  const report = performance(s, {
    propertyId: "property-hostel",
    start: "2027-01-01",
    end: "2027-01-02",
  });
  expect(report.capacity).toBe(
    s.units.filter(
      (u) =>
        u.propertyId === "property-hostel" && u.parentUnitId === "unit-dorm",
    ).length,
  );
  expect(report.sold).toBe(report.capacity);
  expect(report.occupancy).toBe(1);
  expect(report.roomRevenueMinor).toBe(1001);
  const bedType = s.units.find(
    (u) => u.parentUnitId === "unit-dorm",
  )!.inventoryTypeId;
  const filtered = performance(s, {
    propertyId: "property-hostel",
    start: "2027-01-01",
    end: "2027-01-02",
    inventoryTypeId: bedType,
  });
  expect(filtered.occupancy).toBe(1);
  expect(filtered.roomRevenueMinor).toBe(1001);
});
test("market CSV supports quoted fields and rejects malformed data, decimals and formulas", () => {
  const row =
    '2027-01-01,2026-11-01,"Fuente, autorizada",Centro,MXN,125000,6500,20';
  expect(parseMarketCsv(marketCsvHeader + "\r\n" + row)[0].source).toBe(
    "Fuente, autorizada",
  );
  expect(() =>
    parseMarketCsv(marketCsvHeader + "\n" + row.replace("6500", "65.2")),
  ).toThrow();
  expect(() =>
    parseMarketCsv(
      marketCsvHeader + "\n" + row.replace("125000", "=HYPERLINK(x)"),
    ),
  ).toThrow();
  expect(() => parseMarketCsv(marketCsvHeader + "\n" + row + '"')).toThrow();
});
test("market benchmark uses latest observations, independent dates and exact weighted cents", () => {
  const base = {
    id: "first",
    propertyId: "p",
    date: "2027-01-01",
    observedOn: "2026-10-01",
    source: "Provider",
    market: "Center",
    currency: "MXN",
    adrMinor: 100000000001,
    occupancyBps: 5000,
    sampleSize: 1000000,
  };
  const rows = [
    { ...base, adrMinor: 1 },
    { ...base, id: "new", observedOn: "2026-11-01", adrMinor: 100000000000 },
    { ...base, id: "usd", currency: "USD", adrMinor: 1 },
  ];
  const summary = marketSummary(
    rows,
    "2027-01-01",
    "2027-01-02",
    "MXN",
    "2026-11-06",
  );
  expect(summary.adrMinor).toBe(100000000000);
  expect(summary.observations).toHaveLength(1);
  expect(summary.dates).toBe(1);
});

test("cent allocation remains exact at the maximum safe integer", () => {
  const total = Number.MAX_SAFE_INTEGER;
  const allocated = Array.from({ length: 730 }, (_, i) =>
    BigInt(allocatedRevenue(total, 730, i)),
  );
  expect(allocated.reduce((a, b) => a + b, 0n)).toBe(BigInt(total));
  expect(allocated[0] - allocated[729]).toBeLessThanOrEqual(1n);
});

test("booking lead time uses the property date across UTC midnight", () => {
  const s = state(),
    r = seedState().reservations.find(
      (r) => r.propertyId === "property-hotel",
    )!;
  s.properties.find((p) => p.id === "property-hotel")!.timezone =
    "America/Mazatlan";
  s.reservations = [
    {
      ...r,
      id: "midnight",
      arrival: "2026-11-06",
      departure: "2026-11-07",
      status: "confirmed",
      createdAt: "2026-11-07T00:30:00Z",
    },
  ];
  expect(
    performance(s, {
      propertyId: "property-hotel",
      start: "2026-11-06",
      end: "2026-11-07",
    }).averageLeadDays,
  ).toBe(0);
});

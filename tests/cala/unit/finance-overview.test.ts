import { test, expect } from "vitest";
import { seedState } from "../fixtures/seed";
import {
  financeBuckets,
  financeOverview,
  financeCsv,
} from "@/cala/domain/analytics/finance";
import { summarizePayments } from "@/cala/domain/reservations/payments";
import type { Payment } from "@/cala/domain/model";

const pay = (p: Partial<Payment>): Payment => ({
  id: Math.random().toString(36),
  propertyId: "p",
  reservationId: "r",
  amountMinor: 0,
  provider: "manual",
  externalId: "",
  status: "succeeded",
  createdAt: "2026-11-01T12:00:00Z",
  ...p,
});

test("payment summary: prepayment, refund, pending and security deposit", () => {
  const s = summarizePayments([
    pay({ concept: "prepayment", amountMinor: 159000 }),
    pay({ concept: "payment", amountMinor: 50000, status: "pending" }),
    pay({ concept: "refund", amountMinor: 9000 }),
    pay({ concept: "deposit", amountMinor: 200000 }),
    pay({ concept: "deposit_return", amountMinor: 50000 }),
    pay({ concept: "payment", amountMinor: 99999, status: "failed" }),
    pay({ amountMinor: 1000 }),
  ]);
  expect(s).toEqual({
    paidMinor: 159000 - 9000 + 1000,
    scheduledMinor: 50000,
    prepaymentMinor: 159000,
    prepaymentPaid: true,
    refundedMinor: 9000,
    depositHeldMinor: 150000,
  });
  expect(
    summarizePayments([pay({ concept: "prepayment", amountMinor: 1, status: "pending" })])
      .prepaymentPaid,
  ).toBe(false);
});

test("buckets cover partial months and years", () => {
  expect(financeBuckets("2026-08-15", "2026-10-01", "month")).toEqual([
    { key: "2026-08", start: "2026-08-15", end: "2026-09-01" },
    { key: "2026-09", start: "2026-09-01", end: "2026-10-01" },
  ]);
  expect(financeBuckets("2026-01-01", "2028-01-01", "year").map((b) => b.key)).toEqual([
    "2026",
    "2027",
  ]);
});

test("overview splits revenue across months, counts by arrival and tracks balances", () => {
  const state = seedState();
  const property = state.properties[0];
  const unit = state.units.find((u) => u.propertyId === property.id && u.active)!;
  const base = state.reservations.find((r) => r.propertyId === property.id)!;
  state.reservations = [
    {
      ...base,
      id: "cross",
      unitId: unit.id,
      inventoryTypeId: unit.inventoryTypeId,
      arrival: "2030-01-30",
      departure: "2030-02-03",
      status: "confirmed",
      source: "airbnb",
      totalMinor: 400000,
    },
    {
      ...base,
      id: "gone",
      arrival: "2030-02-10",
      departure: "2030-02-12",
      status: "cancelled",
      source: "direct",
    },
  ];
  state.folioItems = [];
  state.blocks = [];
  state.payments = [
    pay({ propertyId: property.id, reservationId: "cross", concept: "prepayment", amountMinor: 100000, createdAt: "2030-01-05T12:00:00Z" }),
    pay({ propertyId: property.id, reservationId: "cross", concept: "deposit", amountMinor: 50000, createdAt: "2030-01-30T12:00:00Z" }),
  ];
  const o = financeOverview(state, {
    propertyIds: [property.id],
    start: "2030-01-01",
    end: "2030-03-01",
    granularity: "month",
  });
  expect(o.buckets.map((b) => [b.key, b.revenueMinor, b.nights, b.bookings, b.cancellations, b.collectedMinor])).toEqual([
    ["2030-01", 200000, 2, 1, 0, 100000],
    ["2030-02", 200000, 2, 0, 1, 0],
  ]);
  expect(o.totals.revenueMinor).toBe(400000);
  expect(o.totals.outstandingMinor).toBe(300000);
  expect(o.totals.depositsHeldMinor).toBe(50000);
  expect(o.receivables.map((r) => r.reservationId)).toEqual(["cross"]);
  expect(o.channels.find((c) => c.source === "Airbnb")?.revenueMinor).toBe(400000);
  expect(o.totals.occupancy).toBeGreaterThan(0);
  expect(financeCsv(o, "MXN")).toContain('"2030-01","2000.00"');
  expect(() =>
    financeOverview(state, { propertyIds: [property.id], start: "2030-03-01", end: "2030-01-01", granularity: "month" }),
  ).toThrow();
});

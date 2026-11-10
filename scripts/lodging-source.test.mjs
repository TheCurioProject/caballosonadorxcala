import test from "node:test";
import assert from "node:assert/strict";
import {
  moneyMinor,
  sourceDate,
  buildSmoobuPlan,
  CASA_UNITS,
} from "./lib/lodging-source.mjs";
export function syntheticSource() {
  return {
    format: "casa-smoobu-readonly-v1",
    accountId: 1939851,
    apartments: CASA_UNITS.map((u) => ({
      id: u.sourceId,
      name: u.slug,
      details: {
        currency: "MXN",
        rooms: {
          maxOccupancy: u.kind === "whole_home" ? 12 : 2,
          bathrooms: u.kind === "whole_home" ? 6 : 1,
        },
      },
    })),
    bookings: [],
    rates: {
      data: Object.fromEntries(
        CASA_UNITS.map((u) => [
          u.sourceId,
          {
            "2034-01-01": {
              price: 100,
              min_length_of_stay: null,
              available: 1,
            },
            "2034-01-02": {
              price: 100,
              min_length_of_stay: null,
              available: 1,
            },
          },
        ]),
      ),
    },
  };
}
test("migration money is integer based and rejects malformed or fractional-cent amounts", () => {
  assert.equal(moneyMinor("1234.56"), 123456);
  assert.equal(moneyMinor("100.5000"), 10050);
  for (const value of ["-1", "12.345", "1,000", "NaN", "Infinity"])
    assert.throws(() => moneyMinor(value));
  assert.throws(() => sourceDate("2034-02-30"));
});
test("the exact seven house units are required and other houses are excluded", () => {
  const source = syntheticSource();
  source.bookings.push({ apartment: { id: 999 }, id: 1 });
  const plan = buildSmoobuPlan(source);
  assert.equal(plan.units.length, 7);
  assert.equal(plan.summary.otherPropertiesExcluded, 1);
  source.accountId = 123;
  assert.throws(() => buildSmoobuPlan(source));
});
test("source overlap, missing rooms and unexplained calendar closures cannot silently become sellable", () => {
  const source = syntheticSource();
  source.rates.data[3577971]["2034-01-01"].available = 0;
  assert.equal(buildSmoobuPlan(source).unexplainedClosures.length, 1);
  source.bookings = [
    {
      id: 1,
      apartment: { id: 3577971 },
      arrival: "2034-01-01",
      departure: "2034-01-03",
      adults: 2,
      children: 0,
      price: 200,
      prepayment: 0,
      type: "reservation",
    },
    {
      id: 2,
      apartment: { id: 3577956 },
      arrival: "2034-01-01",
      departure: "2034-01-03",
      adults: 12,
      children: 0,
      price: 200,
      prepayment: 0,
      type: "reservation",
    },
  ];
  assert.throws(() => buildSmoobuPlan(source), /CONFLICT/);
  source.bookings[1].type = "cancellation";
  assert.equal(buildSmoobuPlan(source).unexplainedClosures.length, 0);
  source.apartments.pop();
  assert.throws(() => buildSmoobuPlan(source), /UNIT_INVALID/);
});

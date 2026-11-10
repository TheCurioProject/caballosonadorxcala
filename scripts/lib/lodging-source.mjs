import crypto from "node:crypto";
import { SafeError } from "./site-data-errors.mjs";
export const CASA_ACCOUNT = 1939851;
export const CASA_UNITS = [
  {
    sourceId: 3577956,
    slug: "casa-completa",
    kind: "whole_home",
    photoRoom: null,
  },
  { sourceId: 3577971, slug: "paso-suave", kind: "room", photoRoom: 1 },
  { sourceId: 3577976, slug: "estrella", kind: "room", photoRoom: 2 },
  { sourceId: 3577981, slug: "la-luna", kind: "room", photoRoom: 3 },
  { sourceId: 3577986, slug: "campo-abierto", kind: "room", photoRoom: 4 },
  { sourceId: 3577991, slug: "madera-viva", kind: "room", photoRoom: 5 },
  { sourceId: 3577996, slug: "el-sueno-del-mar", kind: "room", photoRoom: 6 },
];
export function fingerprint(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}
export function moneyMinor(value) {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value ?? "0").trim());
  if (!match || /[1-9]/.test((match[2] || "").slice(2)))
    throw new SafeError("SOURCE_AMOUNT_INVALID");
  const minor =
    Number(match[1]) * 100 +
    Number((match[2] || "").slice(0, 2).padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > 100000000000)
    throw new SafeError("SOURCE_AMOUNT_INVALID");
  return minor;
}
export function sourceDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw new SafeError("SOURCE_DATE_INVALID");
  return value;
}
export function conflicts(left, right) {
  return (
    left === right ||
    left === CASA_UNITS[0].sourceId ||
    right === CASA_UNITS[0].sourceId
  );
}
export function sourceIsActive(row) {
  return row.type !== "cancellation";
}
export function sourceIsBlocked(row) {
  return row["is-blocked-booking"] === true || row["is-blocked-booking"] === 1;
}
export function buildSmoobuPlan(snapshot) {
  if (
    snapshot.format !== "casa-smoobu-readonly-v1" ||
    snapshot.accountId !== CASA_ACCOUNT ||
    !Array.isArray(snapshot.apartments) ||
    !Array.isArray(snapshot.bookings)
  )
    throw new SafeError("SOURCE_ACCOUNT_OR_FORMAT_INVALID");
  const sourceIds = new Set(CASA_UNITS.map((u) => u.sourceId));
  const apartmentMap = new Map(
    snapshot.apartments.map((a) => [Number(a.id), a]),
  );
  const units = CASA_UNITS.map((unit) => {
    const apartment = apartmentMap.get(unit.sourceId),
      days = snapshot.rates?.data?.[unit.sourceId];
    if (
      !apartment ||
      apartment.details?.currency !== "MXN" ||
      !Number.isSafeInteger(apartment.details.rooms?.maxOccupancy) ||
      apartment.details.rooms.maxOccupancy < 1 ||
      !days
    )
      throw new SafeError("SOURCE_UNIT_INVALID");
    const rates = Object.entries(days).map(([date, row]) => ({
      date: sourceDate(date),
      priceMinor: row.price == null ? null : moneyMinor(row.price),
      minStay:
        row.min_length_of_stay === null ? 2 : Number(row.min_length_of_stay),
      available: Number(row.available),
    }));
    if (
      rates.some(
        (r) =>
          !Number.isInteger(r.minStay) ||
          r.minStay < 1 ||
          r.minStay > 366 ||
          !Number.isInteger(r.available) ||
          r.available < 0,
      )
    )
      throw new SafeError("SOURCE_RATE_INVALID");
    const priced = rates.filter(
      (r) => r.priceMinor !== null && r.priceMinor > 0,
    );
    return {
      ...unit,
      apartment,
      rates,
      baseRateMinor: priced.length
        ? Math.min(...priced.map((r) => r.priceMinor))
        : 0,
      openThrough: priced.length
        ? priced
            .map((r) => r.date)
            .sort()
            .at(-1)
        : null,
    };
  });
  const seen = new Set();
  const rows = snapshot.bookings.filter((row) =>
    sourceIds.has(Number(row.apartment?.id)),
  );
  for (const row of rows) {
    if (!Number.isSafeInteger(row.id) || row.id < 1 || seen.has(row.id))
      throw new SafeError("SOURCE_BOOKING_ID_INVALID");
    seen.add(row.id);
    if (
      sourceDate(row.departure) <= sourceDate(row.arrival) ||
      Date.parse(row.departure) - Date.parse(row.arrival) > 730 * 86400000
    )
      throw new SafeError("SOURCE_BOOKING_DATES_INVALID");
    if (!sourceIsBlocked(row)) {
      moneyMinor(row.price);
      moneyMinor(row.prepayment);
      const adults = Number(row.adults),
        children = Number(row.children || 0),
        unit = units.find((u) => u.sourceId === Number(row.apartment.id));
      if (
        !Number.isSafeInteger(adults) ||
        adults < 1 ||
        !Number.isSafeInteger(children) ||
        children < 0 ||
        adults + children > unit.apartment.details.rooms.maxOccupancy
      )
        throw new SafeError("SOURCE_OCCUPANCY_INVALID");
    }
  }
  const real = rows.filter((r) => sourceIsActive(r) && !sourceIsBlocked(r));
  for (let i = 0; i < real.length; i++)
    for (const other of real.slice(0, i))
      if (
        conflicts(Number(real[i].apartment.id), Number(other.apartment.id)) &&
        real[i].arrival < other.departure &&
        real[i].departure > other.arrival
      )
        throw new SafeError("SOURCE_RESERVATION_CONFLICT_REVIEW_REQUIRED");
  const unexplainedClosures = [];
  for (const unit of units) {
    const dates = unit.rates
      .filter(
        (r) =>
          r.available === 0 &&
          !rows.some(
            (b) =>
              sourceIsActive(b) &&
              conflicts(unit.sourceId, Number(b.apartment.id)) &&
              b.arrival <= r.date &&
              b.departure > r.date,
          ),
      )
      .map((r) => r.date)
      .sort();
    for (const day of dates) {
      const last = unexplainedClosures.at(-1);
      if (last?.sourceId === unit.sourceId && last.departure === day)
        last.departure = new Date(Date.parse(day) + 86400000)
          .toISOString()
          .slice(0, 10);
      else
        unexplainedClosures.push({
          sourceId: unit.sourceId,
          arrival: day,
          departure: new Date(Date.parse(day) + 86400000)
            .toISOString()
            .slice(0, 10),
        });
    }
  }
  return {
    units,
    rows,
    unexplainedClosures,
    summary: {
      units: units.length,
      reservations: rows.filter((r) => !sourceIsBlocked(r)).length,
      blocks: rows.filter(sourceIsBlocked).length,
      cancelled: rows.filter((r) => !sourceIsActive(r)).length,
      otherPropertiesExcluded: snapshot.bookings.length - rows.length,
      unexplainedClosureRanges: unexplainedClosures.length,
    },
  };
}

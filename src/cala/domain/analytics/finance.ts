import type { State } from "../model";
import { allocatedRevenue, performance } from "./performance";
import { summarizePayments } from "../reservations/payments";
import { invariant } from "../shared/errors";
import { sourceLabel } from "../messaging/ota";

/**
 * Financial overview (Smoobu "Analytics", plus money actually collected).
 *
 * - Revenue = what the guest pays for the stay (folio: room + extras, or the agreed
 *   price), split across stay nights, so a stay crossing months counts in both.
 * - Bookings / cancellations are counted by arrival date.
 * - Collected = payments received in the period (cash basis), net of refunds;
 *   security deposits are reported apart.
 */
export type FinanceState = Pick<
  State,
  | "properties"
  | "units"
  | "inventoryTypes"
  | "reservations"
  | "blocks"
  | "folioItems"
  | "payments"
  | "guests"
>;
export interface FinanceFilter {
  propertyIds: string[];
  inventoryTypeId?: string;
  /** Inclusive first day, exclusive last day (YYYY-MM-DD). */
  start: string;
  end: string;
  granularity: "month" | "year";
  includePending?: boolean;
}
export interface FinanceBucket {
  key: string;
  start: string;
  end: string;
  revenueMinor: number;
  nights: number;
  bookings: number;
  bookingNights: number;
  cancellations: number;
  cancelledNights: number;
  capacity: number;
  occupied: number;
  occupancy: number | null;
  collectedMinor: number;
}
export interface FinanceChannel {
  source: string;
  revenueMinor: number;
  bookings: number;
  nights: number;
  cancellations: number;
}
export interface FinanceProperty {
  propertyId: string;
  name: string;
  revenueMinor: number;
  nights: number;
  bookings: number;
  occupancy: number | null;
  adrMinor: number | null;
}
export interface Receivable {
  reservationId: string;
  propertyId: string;
  guest: string;
  code: string;
  arrival: string;
  departure: string;
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
}

const DAY = 86400000;
const stayNights = (a: string, d: string) =>
  Math.round((Date.parse(d) - Date.parse(a)) / DAY);
const addDay = (date: string, n: number) =>
  new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);
const ACTIVE = ["confirmed", "checked_in", "checked_out"];
const CANCELLED = ["cancelled", "no_show"];

export function financeBuckets(
  start: string,
  end: string,
  granularity: "month" | "year",
) {
  const out: { key: string; start: string; end: string }[] = [];
  let cursor = granularity === "year" ? start.slice(0, 4) + "-01-01" : start.slice(0, 7) + "-01";
  while (cursor < end) {
    const [y, m] = cursor.split("-").map(Number);
    const next =
      granularity === "year"
        ? `${y + 1}-01-01`
        : m === 12
          ? `${y + 1}-01-01`
          : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    out.push({
      key: granularity === "year" ? String(y) : cursor.slice(0, 7),
      start: cursor < start ? start : cursor,
      end: next > end ? end : next,
    });
    cursor = next;
  }
  return out;
}

export function financeOverview(state: FinanceState, filter: FinanceFilter) {
  invariant(
    /^\d{4}-\d{2}-\d{2}$/.test(filter.start) &&
      /^\d{4}-\d{2}-\d{2}$/.test(filter.end) &&
      filter.start < filter.end,
    "INVALID_RANGE",
    "Elige un rango válido: la fecha final debe ser posterior a la inicial.",
  );
  invariant(
    stayNights(filter.start, filter.end) <= 3700,
    "RANGE_TOO_LONG",
    "El rango máximo es de 10 años.",
  );
  const props = new Set(filter.propertyIds);
  const unitType = new Map(state.units.map((u) => [u.id, u.inventoryTypeId]));
  const inScope = state.reservations.filter(
    (r) =>
      props.has(r.propertyId) &&
      (!filter.inventoryTypeId ||
        r.inventoryTypeId === filter.inventoryTypeId ||
        (r.unitId !== null && unitType.get(r.unitId) === filter.inventoryTypeId)),
  );
  const statuses = filter.includePending ? [...ACTIVE, "pending"] : ACTIVE;
  const active = inScope.filter((r) => statuses.includes(r.status));
  const folioTotals = new Map<string, number>();
  for (const i of state.folioItems)
    folioTotals.set(i.reservationId, (folioTotals.get(i.reservationId) ?? 0) + i.amountMinor);
  const totalOf = (r: (typeof inScope)[number]) => folioTotals.get(r.id) ?? r.totalMinor;
  const buckets = financeBuckets(filter.start, filter.end, filter.granularity);
  const bucketOf = (date: string) =>
    buckets.findIndex((b) => b.start <= date && date < b.end);
  const rows: FinanceBucket[] = buckets.map((b) => ({
    ...b,
    revenueMinor: 0,
    nights: 0,
    bookings: 0,
    bookingNights: 0,
    cancellations: 0,
    cancelledNights: 0,
    capacity: 0,
    occupied: 0,
    occupancy: null,
    collectedMinor: 0,
  }));
  const channels = new Map<string, FinanceChannel>();
  const channel = (raw: string) => {
    const source = sourceLabel(raw || "direct");
    let c = channels.get(source);
    if (!c) channels.set(source, (c = { source, revenueMinor: 0, bookings: 0, nights: 0, cancellations: 0 }));
    return c;
  };
  const perProperty = new Map<string, { revenueMinor: number; nights: number; bookings: number }>();
  const propRow = (id: string) => {
    let p = perProperty.get(id);
    if (!p) perProperty.set(id, (p = { revenueMinor: 0, nights: 0, bookings: 0 }));
    return p;
  };

  for (const r of active) {
    const n = stayNights(r.arrival, r.departure);
    if (n <= 0) continue;
    const total = totalOf(r);
    const arrivalBucket = bucketOf(r.arrival);
    if (arrivalBucket >= 0) {
      rows[arrivalBucket].bookings++;
      rows[arrivalBucket].bookingNights += n;
      channel(r.source).bookings++;
      propRow(r.propertyId).bookings++;
    }
    for (let i = 0; i < n; i++) {
      const date = addDay(r.arrival, i);
      const b = bucketOf(date);
      if (b < 0) continue;
      const amount = allocatedRevenue(total, n, i);
      rows[b].revenueMinor += amount;
      rows[b].nights++;
      const c = channel(r.source);
      c.revenueMinor += amount;
      c.nights++;
      const p = propRow(r.propertyId);
      p.revenueMinor += amount;
      p.nights++;
    }
  }
  for (const r of inScope) {
    if (!CANCELLED.includes(r.status)) continue;
    const b = bucketOf(r.arrival);
    if (b < 0) continue;
    rows[b].cancellations++;
    rows[b].cancelledNights += Math.max(stayNights(r.arrival, r.departure), 0);
    channel(r.source).cancellations++;
  }

  // Occupancy: physical resources, via the same engine as the Reports screen.
  const occupancyByProperty = new Map<string, { capacity: number; occupied: number }>();
  for (const propertyId of props) {
    if (!state.properties.some((p) => p.id === propertyId)) continue;
    const report = performance(state, {
      propertyId,
      start: filter.start,
      end: filter.end,
      inventoryTypeId: filter.inventoryTypeId,
      includePending: filter.includePending,
    });
    const acc = { capacity: 0, occupied: 0 };
    for (const d of report.days) {
      const b = bucketOf(d.date);
      if (b < 0) continue;
      rows[b].capacity += d.capacity;
      rows[b].occupied += d.occupied;
      acc.capacity += d.capacity;
      acc.occupied += d.occupied;
    }
    occupancyByProperty.set(propertyId, acc);
  }
  for (const row of rows)
    row.occupancy = row.capacity ? Math.min(row.occupied / row.capacity, 1) : null;

  // Money received in the period (cash basis).
  const scopeIds = new Set(inScope.map((r) => r.id));
  const scopedPayments = state.payments.filter((p) => scopeIds.has(p.reservationId));
  let depositsReceivedMinor = 0;
  for (const p of scopedPayments) {
    if (p.status !== "succeeded") continue;
    const date = p.createdAt.slice(0, 10);
    const b = bucketOf(date);
    if (b < 0) continue;
    const concept = p.concept ?? "payment";
    if (concept === "deposit") depositsReceivedMinor += p.amountMinor;
    else if (concept === "deposit_return") depositsReceivedMinor -= p.amountMinor;
    else rows[b].collectedMinor += concept === "refund" ? -p.amountMinor : p.amountMinor;
  }

  // Balances still owed on stays that touch the period (or are already over).
  const paymentsBy = new Map<string, typeof scopedPayments>();
  for (const p of scopedPayments) {
    const list = paymentsBy.get(p.reservationId) ?? [];
    list.push(p);
    paymentsBy.set(p.reservationId, list);
  }
  const guestName = new Map(
    state.guests.map((g) => [g.id, `${g.firstName} ${g.lastName}`.trim()]),
  );
  let depositsHeldMinor = 0;
  const receivables: Receivable[] = [];
  for (const r of inScope) {
    const summary = summarizePayments(paymentsBy.get(r.id) ?? []);
    depositsHeldMinor += summary.depositHeldMinor;
    if (!["pending", ...ACTIVE].includes(r.status)) continue;
    if (!(r.arrival < filter.end && r.departure > filter.start)) continue;
    const total = totalOf(r);
    const balance = total - summary.paidMinor;
    if (balance <= 0) continue;
    receivables.push({
      reservationId: r.id,
      propertyId: r.propertyId,
      guest: guestName.get(r.guestId) || r.confirmationCode,
      code: r.confirmationCode,
      arrival: r.arrival,
      departure: r.departure,
      totalMinor: total,
      paidMinor: summary.paidMinor,
      balanceMinor: balance,
    });
  }
  receivables.sort((a, b) => a.arrival.localeCompare(b.arrival));

  const sum = (k: keyof FinanceBucket) =>
    rows.reduce((n, r) => n + (r[k] as number), 0);
  const revenueMinor = sum("revenueMinor"),
    nights = sum("nights"),
    capacity = sum("capacity"),
    occupied = sum("occupied");
  invariant(
    Number.isSafeInteger(revenueMinor),
    "ANALYTICS_AMOUNT_OVERFLOW",
    "El volumen monetario excede la precisión permitida. Reduce el rango.",
  );
  const bookings = sum("bookings"),
    bookingNights = sum("bookingNights");
  const properties: FinanceProperty[] = [...props]
    .map((id) => {
      const p = perProperty.get(id) ?? { revenueMinor: 0, nights: 0, bookings: 0 };
      const occ = occupancyByProperty.get(id);
      return {
        propertyId: id,
        name: state.properties.find((x) => x.id === id)?.name ?? id,
        ...p,
        occupancy: occ?.capacity ? Math.min(occ.occupied / occ.capacity, 1) : null,
        adrMinor: p.nights ? Math.round(p.revenueMinor / p.nights) : null,
      };
    })
    .filter((p) => state.properties.some((x) => x.id === p.propertyId));
  return {
    buckets: rows,
    channels: [...channels.values()].sort((a, b) => b.revenueMinor - a.revenueMinor),
    properties,
    receivables,
    totals: {
      revenueMinor,
      nights,
      bookings,
      bookingNights,
      cancellations: sum("cancellations"),
      cancelledNights: sum("cancelledNights"),
      occupancy: capacity ? Math.min(occupied / capacity, 1) : null,
      adrMinor: nights ? Math.round(revenueMinor / nights) : null,
      revparMinor: capacity ? Math.round(revenueMinor / capacity) : null,
      averageStay: bookings ? bookingNights / bookings : null,
      collectedMinor: sum("collectedMinor"),
      outstandingMinor: receivables.reduce((n, r) => n + r.balanceMinor, 0),
      depositsHeldMinor,
      depositsReceivedMinor,
    },
  };
}
export type FinanceOverview = ReturnType<typeof financeOverview>;

export function financeCsv(o: FinanceOverview, currency: string) {
  const rows: (string | number)[][] = [
    [
      "periodo",
      `ingresos_${currency}`,
      "noches",
      "reservas",
      "cancelaciones",
      "ocupacion_pct",
      `cobrado_${currency}`,
    ],
    ...o.buckets.map((b) => [
      b.key,
      (b.revenueMinor / 100).toFixed(2),
      b.nights,
      b.bookings,
      b.cancellations,
      b.occupancy === null ? "" : (b.occupancy * 100).toFixed(1),
      (b.collectedMinor / 100).toFixed(2),
    ]),
    [],
    ["canal", `ingresos_${currency}`, "reservas", "noches", "cancelaciones"],
    ...o.channels.map((c) => [
      c.source,
      (c.revenueMinor / 100).toFixed(2),
      c.bookings,
      c.nights,
      c.cancellations,
    ]),
    [],
    ["reserva", "huesped", "llegada", "salida", `total_${currency}`, `pagado_${currency}`, `saldo_${currency}`],
    ...o.receivables.map((r) => [
      r.code,
      r.guest,
      r.arrival,
      r.departure,
      (r.totalMinor / 100).toFixed(2),
      (r.paidMinor / 100).toFixed(2),
      (r.balanceMinor / 100).toFixed(2),
    ]),
  ];
  return (
    "﻿" +
    rows
      .map((row) => row.map((c) => '"' + String(c).replaceAll('"', '""') + '"').join(","))
      .join("\r\n")
  );
}

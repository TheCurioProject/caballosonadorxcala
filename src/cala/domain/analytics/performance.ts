import type { Snapshot, State } from "../model";
import { resources } from "../inventory/availability";
import { nights, overlaps } from "../shared/dates";
import { invariant } from "../shared/errors";

export type AnalyticsState = Pick<
  State,
  "properties" | "units" | "inventoryTypes" | "reservations" | "blocks"
>;
export interface PerformanceFilter {
  propertyId: string;
  start: string;
  end: string;
  source?: string;
  inventoryTypeId?: string;
  includePending?: boolean;
}
export interface PerformanceDay {
  date: string;
  capacity: number;
  blocked: number;
  occupied: number;
  roomRevenueMinor: number;
}

/** Allocate every cent once. The remainder belongs to the earliest stay nights. */
export function allocatedRevenue(
  totalMinor: number,
  stayNights: number,
  index: number,
) {
  const amount = BigInt(totalMinor),
    count = BigInt(stayNights);
  return Number(amount / count + (BigInt(index) < amount % count ? 1n : 0n));
}

export function performance(state: AnalyticsState, filter: PerformanceFilter) {
  const dates = nights(filter.start, filter.end);
  const units = state.units.filter(
    (u) =>
      u.active &&
      u.propertyId === filter.propertyId &&
      (!filter.inventoryTypeId || u.inventoryTypeId === filter.inventoryTypeId),
  );
  const resourceIds = new Set(
    units.flatMap((u) => [...resources(state, u.id)]),
  );
  const inScope = state.reservations.filter(
    (r) =>
      r.propertyId === filter.propertyId &&
      (!filter.source || r.source === filter.source) &&
      (!filter.inventoryTypeId ||
        (r.unitId
          ? [...resources(state, r.unitId)].some((id) => resourceIds.has(id))
          : r.inventoryTypeId === filter.inventoryTypeId)),
  );
  function nightlyRevenue(
    r: AnalyticsState["reservations"][number],
    index: number,
    duration: number,
  ) {
    const amount = allocatedRevenue(r.totalMinor, duration, index);
    if (!r.unitId) return amount;
    const ids = [...resources(state, r.unitId)].sort();
    return ids.reduce(
      (sum, id, i) =>
        sum +
        (resourceIds.has(id) ? allocatedRevenue(amount, ids.length, i) : 0),
      0,
    );
  }
  const reservations = inScope.filter(
    (r) =>
      overlaps(filter.start, filter.end, r.arrival, r.departure) &&
      [
        "confirmed",
        "checked_in",
        "checked_out",
        ...(filter.includePending ? ["pending"] : []),
      ].includes(r.status),
  );
  const days: PerformanceDay[] = dates.map((date) => {
    const blocked = new Set(
      state.blocks
        .filter(
          (b) =>
            b.active &&
            b.propertyId === filter.propertyId &&
            b.arrival <= date &&
            b.departure > date,
        )
        .flatMap((b) =>
          [...resources(state, b.unitId)].filter((id) => resourceIds.has(id)),
        ),
    );
    let occupied = 0,
      roomRevenueMinor = 0;
    for (const r of reservations) {
      if (r.arrival > date || r.departure <= date) continue;
      occupied += r.unitId
        ? [...resources(state, r.unitId)].filter((id) => resourceIds.has(id))
            .length
        : 1;
      const duration = Math.round(
        (Date.parse(r.departure) - Date.parse(r.arrival)) / 86400000,
      );
      const index = Math.round(
        (Date.parse(date) - Date.parse(r.arrival)) / 86400000,
      );
      roomRevenueMinor += nightlyRevenue(r, index, duration);
    }
    return {
      date,
      capacity: resourceIds.size,
      blocked: blocked.size,
      occupied,
      roomRevenueMinor,
    };
  });
  const sum = (key: keyof Omit<PerformanceDay, "date">) =>
    days.reduce((n, d) => n + d[key], 0);
  const sold = sum("occupied"),
    capacity = sum("capacity"),
    blocked = sum("blocked"),
    roomRevenueMinor = sum("roomRevenueMinor");
  invariant(
    Number.isSafeInteger(roomRevenueMinor) &&
      days.every((d) => Number.isSafeInteger(d.roomRevenueMinor)),
    "ANALYTICS_AMOUNT_OVERFLOW",
    "El volumen monetario excede la precisión permitida. Reduce el rango del reporte.",
  );
  const arrivalCohort = inScope.filter(
    (r) =>
      r.status !== "draft" &&
      r.arrival >= filter.start &&
      r.arrival < filter.end,
  );
  const cancellations = arrivalCohort.filter(
    (r) => r.status === "cancelled",
  ).length;
  const cancelled = arrivalCohort.filter((r) => r.status === "cancelled");
  const cancellationsByChannel = [...new Set(cancelled.map((r) => r.source))]
    .sort()
    .map((source) => ({
      source,
      count: cancelled.filter((r) => r.source === source).length,
    }));
  const channels = [...new Set(reservations.map((r) => r.source))]
    .sort()
    .map((source) => {
      const bookings = reservations.filter((r) => r.source === source);
      let revenueMinor = 0,
        soldNights = 0;
      for (const r of bookings) {
        const duration = Math.round(
          (Date.parse(r.departure) - Date.parse(r.arrival)) / 86400000,
        );
        for (let i = 0; i < duration; i++) {
          const date = new Date(Date.parse(r.arrival) + i * 86400000)
            .toISOString()
            .slice(0, 10);
          if (date >= filter.start && date < filter.end) {
            revenueMinor += nightlyRevenue(r, i, duration);
            soldNights++;
          }
        }
      }
      return {
        source,
        bookings: bookings.length,
        revenueMinor,
        nights: soldNights,
      };
    });
  const bookingDate = new Intl.DateTimeFormat("en-CA", {
    timeZone:
      state.properties.find((p) => p.id === filter.propertyId)?.timezone ??
      "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const leadTimes = reservations
    .map((r) => {
      if (!Number.isFinite(Date.parse(r.createdAt))) return NaN;
      const bookedOn = bookingDate.format(new Date(r.createdAt));
      return Math.round(
        (Date.parse(r.arrival) - Date.parse(bookedOn)) / 86400000,
      );
    })
    .filter((v) => Number.isFinite(v) && v >= 0);
  const stayLengths = reservations.map((r) =>
    Math.round((Date.parse(r.departure) - Date.parse(r.arrival)) / 86400000),
  );
  const average = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return {
    days,
    channels,
    cancellationsByChannel,
    sold,
    capacity,
    blocked,
    roomRevenueMinor,
    bookings: reservations.length,
    cancellations,
    cancellationRate: arrivalCohort.length
      ? cancellations / arrivalCohort.length
      : null,
    occupancy: capacity ? sold / capacity : null,
    sellableOccupancy: capacity > blocked ? sold / (capacity - blocked) : null,
    adrMinor: sold
      ? Number(
          (BigInt(roomRevenueMinor) + BigInt(Math.floor(sold / 2))) /
            BigInt(sold),
        )
      : null,
    revparMinor: capacity
      ? Number(
          (BigInt(roomRevenueMinor) + BigInt(Math.floor(capacity / 2))) /
            BigInt(capacity),
        )
      : null,
    averageLeadDays: average(leadTimes),
    averageStayNights: average(stayLengths),
    directShare: reservations.length
      ? reservations.filter((r) => ["direct", "website"].includes(r.source))
          .length / reservations.length
      : null,
  };
}

export function performanceCsv(
  report: ReturnType<typeof performance>,
  currency: string,
  finance: boolean,
) {
  const rows: (string | number)[][] = [
    [
      "fecha",
      "capacidad_recursos",
      "bloqueados",
      "ocupados",
      ...(finance ? [`alojamiento_bruto_${currency}_centavos`] : []),
    ],
    ...report.days.map((d) => [
      d.date,
      d.capacity,
      d.blocked,
      d.occupied,
      ...(finance ? [d.roomRevenueMinor] : []),
    ]),
  ];
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((cell) => '"' + String(cell).replaceAll('"', '""') + '"')
          .join(","),
      )
      .join("\r\n")
  );
}
export function canSeeRevenue(data: Pick<Snapshot, "permissions">) {
  return data.permissions.includes("finance.read");
}

import prisma from "@/lib/prisma";
import { calaConfiguration } from "@/lib/cala/config";
import {
  lodgingSchema,
  type LodgingAvailability,
  type LodgingSelection,
} from "./lodgings";
import { z } from "zod";
import { databaseRead } from "./database-read";

export async function getLodgings(includeUnpublished = false) {
  if (!calaConfiguration().ready) return [];
  const rows = await databaseRead(
    () =>
      prisma.$queryRaw<
        Array<{ data: unknown }>
      >`SELECT site.lodging_catalog(${includeUnpublished}::boolean,${process.env.CALA_ORGANIZATION_ID}::uuid) AS data`,
  );
  return z.array(lodgingSchema).parse(rows[0]?.data ?? []);
}
export async function getLodgingAvailability(lodgingId: string) {
  z.uuid().parse(lodgingId);
  const rows = await databaseRead(
    () =>
      prisma.$queryRaw<
        Array<{ data: LodgingAvailability }>
      >`SELECT site.lodging_availability(${lodgingId}::uuid,${process.env.CALA_ORGANIZATION_ID}::uuid) AS data`,
  );
  if (!rows[0]) throw new Error("LODGING_UNAVAILABLE");
  return rows[0].data;
}
export async function quoteLodging(
  selection: LodgingSelection,
  arrival: Date,
  departure: Date,
  database: Pick<typeof prisma, "$queryRaw"> = prisma,
) {
  const rows = await database.$queryRaw<
    Array<{ total: bigint }>
  >`SELECT site.lodging_quote(${selection.lodgingId}::uuid,${arrival}::date,${departure}::date,${selection.adults}::integer,${selection.children}::integer,${process.env.CALA_ORGANIZATION_ID}::uuid) AS total`;
  const total = Number(rows[0]?.total);
  if (!Number.isSafeInteger(total) || total <= 0)
    throw new Error("LODGING_UNAVAILABLE");
  return total;
}

/** Which CALA rule rejected a quote (rates grid, lodging rules, closures, inventory). */
export function quoteErrorCode(error: unknown) {
  const e = error as { meta?: { message?: string }; message?: string } | null;
  const text = `${e?.meta?.message ?? ""} ${e?.message ?? ""}`;
  return (
    ["RATE_RESTRICTION", "DEPARTURE_CLOSED", "LODGING_SALES_CLOSED", "LODGING_RULES", "OCCUPANCY", "INVENTORY", "UNAVAILABLE", "NO_AVAILABILITY", "UNIT_CONFLICT"].find((c) => text.includes(c)) ??
    "UNAVAILABLE"
  );
}

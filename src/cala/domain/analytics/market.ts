import { z } from "zod";
import { isDate } from "../shared/dates";
import { invariant } from "../shared/errors";
import type { MarketObservation } from "../model";
const date = z.string().refine(isDate, "Fecha inválida");
export const marketRowSchema = z.object({
  date,
  observedOn: date,
  source: z.string().trim().min(1).max(160),
  market: z.string().trim().min(1).max(160),
  currency: z.enum(["MXN", "USD", "EUR"]),
  adrMinor: z.number().int().min(0).max(100000000000),
  occupancyBps: z.number().int().min(0).max(10000),
  sampleSize: z.number().int().min(1).max(1000000),
});
export type MarketRow = z.infer<typeof marketRowSchema>;
export const marketCsvHeader =
  "date,observedOn,source,market,currency,adrMinor,occupancyBps,sampleSize";
/** Strict RFC 4180-style input. No formula execution, inferred columns or coercion to money. */
export function parseMarketCsv(content: string): MarketRow[] {
  invariant(
    content.length <= 100000,
    "CSV_TOO_LARGE",
    "El CSV no puede superar 100 KB.",
  );
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const text = content.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      invariant(!cell && !closed, "CSV_INVALID", "Comillas inválidas en CSV.");
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else {
      invariant(
        !closed,
        "CSV_INVALID",
        "Contenido después de comillas de cierre.",
      );
      cell += c;
    }
  }
  invariant(!quoted, "CSV_INVALID", "El CSV tiene comillas sin cerrar.");
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  invariant(
    rows.shift()?.join(",") === marketCsvHeader,
    "CSV_HEADER",
    `Usa estas columnas: ${marketCsvHeader}`,
  );
  invariant(
    rows.length > 0 && rows.length <= 366,
    "CSV_ROWS",
    "Importa entre 1 y 366 filas por lote.",
  );
  return rows.map((r, index) => {
    invariant(
      r.length === 8,
      "CSV_COLUMNS",
      `La fila ${index + 2} debe tener 8 columnas.`,
    );
    for (const n of [5, 6, 7])
      invariant(
        /^\d+$/.test(r[n]),
        "CSV_NUMBER",
        `La fila ${index + 2} requiere números enteros sin separadores.`,
      );
    return marketRowSchema.parse({
      date: r[0],
      observedOn: r[1],
      source: r[2],
      market: r[3],
      currency: r[4],
      adrMinor: Number(r[5]),
      occupancyBps: Number(r[6]),
      sampleSize: Number(r[7]),
    });
  });
}
export function marketSummary(
  rows: MarketObservation[],
  start: string,
  end: string,
  currency: string,
  asOf: string,
) {
  // One latest observation per source+market+stay date; never blend currencies.
  const latest = new Map<string, MarketObservation>();
  for (const r of rows) {
    if (
      r.date < start ||
      r.date >= end ||
      r.currency !== currency ||
      r.observedOn > asOf
    )
      continue;
    const key = JSON.stringify([r.source, r.market, r.date]);
    if (!latest.has(key) || latest.get(key)!.observedOn < r.observedOn)
      latest.set(key, r);
  }
  const observations = [...latest.values()],
    weight = observations.reduce((n, r) => n + r.sampleSize, 0);
  return {
    observations,
    sampleNights: weight,
    dates: new Set(observations.map((r) => r.date)).size,
    adrMinor: weight
      ? Number(
          (observations.reduce(
            (n, r) => n + BigInt(r.adrMinor) * BigInt(r.sampleSize),
            0n,
          ) +
            BigInt(Math.floor(weight / 2))) /
            BigInt(weight),
        )
      : null,
    occupancy: weight
      ? observations.reduce((n, r) => n + r.occupancyBps * r.sampleSize, 0) /
        weight /
        10000
      : null,
    oldestObservation: observations.map((r) => r.observedOn).sort()[0] ?? null,
  };
}

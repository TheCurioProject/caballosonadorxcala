import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import nextEnv from "@next/env";
import { SafeError, migrationErrorMessage } from "./lib/site-data-errors.mjs";
nextEnv.loadEnvConfig(process.cwd(), false);
const models = [
  ["property", "properties"],
  ["experience", "Experience"],
  ["adminUser", "AdminUser"],
  ["addonPricing", "addon_pricing"],
  ["servicePricing", "service_pricing"],
  ["tourDestination", "tour_destinations"],
  ["siteImage", "site_images"],
  ["writersWorkshop", "writers_workshops"],
  ["stayAmenity", "stay_amenities"],
  ["serviceBlockedDate", "service_blocked_dates"],
  ["icalSource", "ical_sources"],
  ["pricingRule", "pricing_rules"],
  ["blockedDate", "blocked_dates"],
  ["booking", "reservas"],
  ["bookingAddon", "booking_addons"],
  ["serviceBooking", "service_bookings"],
];
const args = process.argv.slice(2),
  command = args[0];
const value = (key) => {
  const index = args.indexOf(key);
  return index < 0 ? undefined : args[index + 1];
};
const checksum = (data) =>
  crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
const stable = (row) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(row)
        .filter(([key]) => key !== "supabaseUserId")
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
function validate(envelope) {
  if (
    envelope.format !== "casa-caballo-site-v1" ||
    !envelope.tables ||
    checksum(envelope.tables) !== envelope.sha256
  )
    throw new SafeError("Export invalid or checksum mismatch");
  for (const [model] of models) {
    const rows = envelope.tables[model];
    if (!Array.isArray(rows) || rows.length > 100000)
      throw new SafeError(`Invalid table: ${model}`);
    const ids = new Set();
    for (const row of rows) {
      if (!Number.isSafeInteger(row.id) || row.id < 1 || ids.has(row.id))
        throw new SafeError(`Invalid or duplicate id in ${model}`);
      ids.add(row.id);
      for (const [key, number] of Object.entries(row))
        if (typeof number === "number" && !Number.isFinite(number))
          throw new SafeError(`Invalid number: ${model}.${key}`);
    }
  }
  for (const row of envelope.tables.booking) {
    if (!(new Date(row.checkOut) > new Date(row.checkIn)) || row.totalPrice < 0)
      throw new SafeError("Invalid booking dates or amount");
  }
}
async function run() {
  if (command === "export") {
    if (!process.env.DATABASE_URL?.match(/^(mysql|mariadb):/))
      throw new SafeError("Set the legacy MySQL DATABASE_URL before exporting");
    const { PrismaClient } = await import("@prisma/client");
    const client = new PrismaClient({
      datasources: {
        db: { url: process.env.DATABASE_URL.replace(/^mariadb:/, "mysql:") },
      },
    });
    try {
      const tables = await client.$transaction(
        async (tx) => {
          const data = {};
          for (const [model] of models)
            data[model] = await tx[model].findMany({ orderBy: { id: "asc" } });
          return JSON.parse(JSON.stringify(data));
        },
        { isolationLevel: "RepeatableRead", timeout: 300000 },
      );
      const envelope = {
        format: "casa-caballo-site-v1",
        exportedAt: new Date().toISOString(),
        tables,
        sha256: checksum(tables),
      };
      validate(envelope);
      const dir = path.resolve(".supabase-migration");
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      const destination =
        path.join(
          dir,
          value("--name")?.replace(/[^a-zA-Z0-9_-]/g, "") ||
            `site-${Date.now()}`,
        ) + ".json";
      await fs.writeFile(destination, JSON.stringify(envelope), {
        mode: 0o600,
        flag: "wx",
      });
      console.log(
        `Private export created: ${path.relative(process.cwd(), destination)}`,
      );
      for (const [model] of models)
        console.log(`${model}: ${tables[model].length}`);
    } finally {
      await client.$disconnect();
    }
    return;
  }
  if (command === "import" || command === "validate") {
    const input = value("--input");
    if (!input) throw new SafeError("Use --input <private export.json>");
    const envelope = JSON.parse(await fs.readFile(input, "utf8"));
    validate(envelope);
    for (const [model] of models)
      console.log(`${model}: ${envelope.tables[model].length}`);
    if (command === "validate" || !args.includes("--apply")) {
      console.log(
        "Validation complete. No database connection or writes. Import requires --apply.",
      );
      return;
    }
    if (!process.env.SUPABASE_DIRECT_URL?.match(/^postgres(ql)?:/))
      throw new SafeError(
        "Set SUPABASE_DIRECT_URL to the migration owner connection",
      );
    const generated = await import("../src/generated/site-postgres/index.js");
    const PrismaClient =
      generated.PrismaClient || generated.default.PrismaClient;
    const client = new PrismaClient({
      datasources: { db: { url: process.env.SUPABASE_DIRECT_URL } },
    });
    try {
      await client.$transaction(
        async (tx) => {
          const initialized =
            await tx.$queryRaw`SELECT count(*)::int AS count FROM pms_private.site_property_map`;
          if (initialized[0].count > 0)
            throw new SafeError(
              "CALA already initialized. Refusing to overwrite live data. Use a fresh staging database.",
            );
          await tx.$executeRaw`SELECT set_config('cala.bridge_origin','site',true)`;
          for (const [model, table] of models) {
            const existing = await tx[model].findMany({
                orderBy: { id: "asc" },
              }),
              byId = new Map(
                existing.map((row) => [
                  row.id,
                  JSON.parse(JSON.stringify(row)),
                ]),
              );
            if (
              existing.some(
                (row) =>
                  !envelope.tables[model].some(
                    (source) => source.id === row.id,
                  ),
              )
            )
              throw new SafeError(`Target has additional rows: ${model}`);
            for (const row of envelope.tables[model]) {
              if (byId.has(row.id)) {
                if (stable(byId.get(row.id)) !== stable(row))
                  throw new SafeError(
                    `Target differs from source: ${model} (no changes committed)`,
                  );
                continue;
              }
              await tx[model].create({ data: row });
            }
            // Identifiers come only from the fixed model list, never from the export or user input.
            const sequence = `site."${table}"`;
            await tx.$queryRawUnsafe(
              `SELECT setval(pg_get_serial_sequence($1,'id'),coalesce((SELECT max(id) FROM site."${table}"),1),(SELECT count(*)>0 FROM site."${table}"))`,
              sequence,
            );
          }
        },
        { timeout: 300000, isolationLevel: "Serializable" },
      );
      console.log(
        "Import committed. Next: run the owner bootstrap and reconcile counts before switching DATA_BACKEND.",
      );
    } finally {
      await client.$disconnect();
    }
    return;
  }
  throw new SafeError(
    "Usage: node scripts/site-data.mjs export | validate --input <file> | import --input <file> [--apply]",
  );
}
run().catch((error) => {
  console.error(migrationErrorMessage(error));
  if (
    command === "export" ||
    command === "validate" ||
    (command === "import" && !args.includes("--apply"))
  )
    console.error("Esta operación no escribe datos en ninguna base de datos.");
  else if (command === "import")
    console.error(
      "Una transacción de importación fallida no confirma cambios. Comprueba el resultado antes de reintentar.",
    );
  process.exitCode = 1;
});

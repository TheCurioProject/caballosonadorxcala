import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";
import { SmoobuClient } from "./lib/smoobu-migration.mjs";
import {
  CASA_ACCOUNT,
  CASA_UNITS,
  buildSmoobuPlan,
  fingerprint,
} from "./lib/lodging-source.mjs";
import { applyLodgingSource } from "./lib/apply-lodging-source.mjs";
import { readLodgingContent } from "./lib/lodging-content.mjs";
import { SafeError, migrationErrorMessage } from "./lib/site-data-errors.mjs";
nextEnv.loadEnvConfig(process.cwd(), false);
const root = process.cwd(),
  args = process.argv.slice(2),
  apply = args.includes("--apply");
const argument = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const privateDir = path.join(root, ".supabase-migration");
let stage = "prepare";
async function privateWrite(filename, value) {
  await fs.mkdir(privateDir, { recursive: true, mode: 0o700 });
  const file = path.join(privateDir, filename);
  await fs.writeFile(
    file,
    typeof value === "string" ? value : JSON.stringify(value, null, 2),
    { mode: 0o600, flag: "wx" },
  );
  return file;
}
async function snapshot() {
  const client = new SmoobuClient({
    key: process.env.SMOOBU_API_KEY,
    secret: process.env.SMOOBU_API_SECRET,
  });
  const account = await client.request("/api/me");
  if (Number(account.id) !== CASA_ACCOUNT)
    throw new SafeError("SOURCE_ACCOUNT_MISMATCH");
  const list = await client.request("/api/apartments");
  const apartments = [];
  for (const unit of CASA_UNITS) {
    const summary = list.apartments?.find(
      (a) => Number(a.id) === unit.sourceId,
    );
    if (!summary) throw new SafeError("SOURCE_UNIT_MISSING");
    apartments.push({
      ...summary,
      details: await client.request("/api/apartments/" + unit.sourceId),
    });
  }
  const bookings = await client.getBookings({
    from: "1900-01-01",
    to: "2100-12-31",
  });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mazatlan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const end = new Date(Date.parse(today + "T00:00:00Z") + 364 * 86400000)
    .toISOString()
    .slice(0, 10);
  const query = new URLSearchParams({ start_date: today, end_date: end });
  for (const unit of CASA_UNITS)
    query.append("apartments[]", String(unit.sourceId));
  const rates = await client.request("/api/rates?" + query);
  const data = {
    format: "casa-smoobu-readonly-v1",
    accountId: CASA_ACCOUNT,
    exportedAt: new Date().toISOString(),
    apartments,
    bookings,
    rates: { start: today, end, ...rates },
  };
  const file = await privateWrite("smoobu-source-" + stamp() + ".json", data);
  return { file, data };
}
function child(script, args = [], extraEnv = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    timeout: 600000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new SafeError(
      "LOCAL_MIGRATION_STEP_FAILED: " + path.basename(script),
    );
  return result.stdout;
}
function envLine(key, value) {
  return (
    key +
    '="' +
    String(value)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\$/g, "\\$") +
    '"'
  );
}
async function activate(scope) {
  const envFile = path.join(root, ".env.local"),
    original = await fs.readFile(envFile, "utf8");
  const updates = {
    DATA_BACKEND: "supabase",
    CALA_ORGANIZATION_ID: scope.organizationId,
    CALA_DEFAULT_PROPERTY_ID: scope.defaultPropertyId,
  };
  const hosting = {
    ...updates,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_DATABASE_URL: process.env.SUPABASE_DATABASE_URL,
  };
  if (Object.values(hosting).some((v) => !v))
    throw new SafeError("HOSTING_CONFIGURATION_INCOMPLETE");
  const seen = new Set();
  const lines = original.split(/\r?\n/).map((line) => {
    const key = line.split("=", 1)[0].trim();
    if (!(key in updates)) return line;
    if (seen.has(key)) throw new SafeError("ENV_DUPLICATE_VARIABLE");
    seen.add(key);
    return envLine(key, updates[key]);
  });
  for (const [key, value] of Object.entries(updates))
    if (!seen.has(key)) lines.push(envLine(key, value));
  await privateWrite(
    "env-local-before-activation-" + stamp() + ".private",
    original,
  );
  if ((await fs.readFile(envFile, "utf8")) !== original)
    throw new SafeError("ENV_CHANGED_DURING_ACTIVATION");
  const temporary = envFile + ".lodging-new";
  await fs.writeFile(temporary, lines.join("\n").replace(/\n*$/, "\n"), {
    mode: 0o600,
    flag: "wx",
  });
  await fs.rename(temporary, envFile);
  return privateWrite(
    "vercel-supabase-" + stamp() + ".env",
    Object.entries(hosting)
      .map(([key, value]) => envLine(key, value))
      .join("\n") + "\n",
  );
}
async function run() {
  if (!args.includes("--legacy-closures-house-only") && apply)
    throw new SafeError(
      "Specify the reviewed legacy closure scope with --legacy-closures-house-only.",
    );
  const input = argument("--source");
  stage = "read-source";
  const source = input
    ? {
        file: path.resolve(input),
        data: JSON.parse(await fs.readFile(input, "utf8")),
      }
    : await snapshot();
  const plan = buildSmoobuPlan(source.data),
    content = await readLodgingContent(root);
  console.log(
    JSON.stringify({
      sourceSnapshot: path.relative(root, source.file),
      ...plan.summary,
      mode: apply ? "apply" : "validation-only",
    }),
  );
  if (!apply) return;
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_DATABASE_URL"])
    if (!process.env[key])
      throw new SafeError("Missing local configuration: " + key);
  if (!(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ))
    throw new SafeError(
      "Missing local configuration: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  if (!process.env.SUPABASE_DIRECT_URL?.startsWith("postgres"))
    throw new SafeError("Set SUPABASE_DIRECT_URL locally.");
  const generated = await import("../src/generated/site-postgres/index.js");
  const PrismaClient = generated.PrismaClient || generated.default.PrismaClient;
  const client = new PrismaClient({
    datasources: { db: { url: process.env.SUPABASE_DIRECT_URL } },
    log: [],
  });
  let siteExport = argument("--site-export");
  try {
    stage = "check-target";
    const existing = (
      await client.$queryRawUnsafe(
        "select count(*)::int as mappings from pms_private.site_property_map",
      )
    )[0];
    if (existing.mappings === 0) {
      if (!siteExport) {
        stage = "export-mysql";
        const name = "cala-rooms-" + stamp();
        child("scripts/site-data.mjs", ["export", "--name", name]);
        siteExport = path.join(".supabase-migration", name + ".json");
      }
      stage = "validate-mysql-export";
      child("scripts/site-data.mjs", ["validate", "--input", siteExport]);
      stage = "import-site-data";
      child("scripts/site-data.mjs", [
        "import",
        "--input",
        siteExport,
        "--apply",
      ]);
    }
    const installed = (
      await client.$queryRawUnsafe(
        "select to_regclass('site.lodgings') is not null as ready",
      )
    )[0];
    if (!installed.ready) {
      stage = "apply-lodging-schema";
      const file = "supabase/migrations/20261109000000_lodgings.sql";
      const sql = await fs.readFile(file, "utf8");
      const wrapped = await privateWrite(
        "lodging-schema-" + stamp() + ".sql",
        "BEGIN;\n" + sql + "\nCOMMIT;\n",
      );
      child(
        "node_modules/prisma/build/index.js",
        [
          "db",
          "execute",
          "--file",
          wrapped,
          "--schema",
          "prisma/supabase/schema.prisma",
        ],
        { SUPABASE_DATABASE_URL: process.env.SUPABASE_DIRECT_URL },
      );
    }
    stage = "bootstrap-and-import";
    const result = await client.$transaction(
      async (tx) => {
        const q = (sql, values = []) => tx.$queryRawUnsafe(sql, ...values);
        const users = await q(
          "select id from auth.users order by created_at,id",
        );
        const ownerId =
          argument("--owner-uid") || (users.length === 1 ? users[0].id : null);
        if (!ownerId || !users.some((u) => u.id === ownerId))
          throw new SafeError(
            "Choose an existing Auth administrator with --owner-uid.",
          );
        if (existing.mappings === 0)
          await q(
            "insert into site.legacy_block_scopes(block_id,scope) select id,'whole_home_sales' from site.blocked_dates on conflict do nothing returning block_id",
          );
        const scope = (
          await q("select site.bootstrap_cala($1::uuid) as data", [ownerId])
        )[0].data;
        const imported = await applyLodgingSource(q, plan, scope, content, {
          allowHistoricalAppend: args.includes("--append-history"),
        });
        return {
          ...imported,
          legacyClosures: (
            await q("select count(*)::int as n from site.legacy_block_scopes")
          )[0].n,
        };
      },
      { timeout: 600000, maxWait: 15000, isolationLevel: "Serializable" },
    );
    stage = "reconcile";
    const counts = (
      await client.$queryRawUnsafe(
        "select (select count(*)::int from site.lodgings) as products,(select count(*)::int from pms_private.smoobu_imports) as source_records,(select count(*)::int from site.integration_alerts where status='open') as open_alerts",
      )
    )[0];
    if (
      counts.products !== 7 ||
      counts.source_records !== plan.rows.length ||
      counts.open_alerts !== 0
    )
      throw new SafeError("RECONCILIATION_REQUIRED_BEFORE_ACTIVATION");
    const receipt = {
      ...result,
      counts,
      sourceSnapshot: path.relative(root, source.file),
      sourceSha256: fingerprint(source.data),
      siteExport,
      completedAt: new Date().toISOString(),
    };
    const receiptPath = await privateWrite(
      "lodging-import-receipt-" + stamp() + ".json",
      receipt,
    );
    stage = "activate-local";
    const hostingFile = await activate(result);
    console.log(
      JSON.stringify({
        ...result,
        receipt: path.relative(root, receiptPath),
        hostingVariablesFile: path.relative(root, hostingFile),
        localBackend: "supabase",
      }),
    );
  } finally {
    await client.$disconnect();
  }
}
run().catch((error) => {
  console.error(
    JSON.stringify({
      stage,
      error: error?.status
        ? "Smoobu HTTP " + error.status
        : migrationErrorMessage(error),
    }),
  );
  process.exitCode = 1;
});

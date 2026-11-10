import fs from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { enrichSmoobu } from "./lib/enrich-smoobu.mjs";
import { SafeError, migrationErrorMessage } from "./lib/site-data-errors.mjs";
nextEnv.loadEnvConfig(process.cwd(), false);
const dir = path.resolve(".supabase-migration"),
  args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const read = (file) => fs.readFile(file, "utf8").then(JSON.parse);
async function run() {
  const profileFile = arg("--profiles"),
    conversationFile = arg("--conversations");
  if (!profileFile || !conversationFile)
    throw new SafeError(
      "Specify the private profile and conversation backups.",
    );
  const profiles = await read(profileFile),
    conversations = await read(conversationFile),
    source = await read(path.join(dir, profiles.sourceFile));
  if (!args.includes("--apply")) {
    console.log(
      JSON.stringify({
        guestProfiles: profiles.guests.length,
        threads: conversations.conversations.length,
        mode: "validation-only",
      }),
    );
    return;
  }
  const generated = await import("../src/generated/site-postgres/index.js");
  const PrismaClient = generated.PrismaClient || generated.default.PrismaClient;
  const db = new PrismaClient({
    datasources: { db: { url: process.env.SUPABASE_DIRECT_URL } },
    log: [],
  });
  const scope = {
    organizationId: process.env.CALA_ORGANIZATION_ID,
    defaultPropertyId: process.env.CALA_DEFAULT_PROPERTY_ID,
  };
  try {
    const backup = {
      guests: await db.$queryRawUnsafe(
        "select g.* from public.guests g where organization_id=$1::uuid",
        scope.organizationId,
      ),
      reservationLinks: await db.$queryRawUnsafe(
        "select id,guest_id,version from public.reservations where organization_id=$1::uuid",
        scope.organizationId,
      ),
      externalIdentities: await db.$queryRawUnsafe(
        "select * from public.external_identities where organization_id=$1::uuid",
        scope.organizationId,
      ),
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.writeFile(
      path.join(dir, "guests-before-enrichment-" + stamp + ".json"),
      JSON.stringify(backup, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
      { mode: 0o600, flag: "wx" },
    );
    const result = await db.$transaction(
      async (tx) => {
        const q = (sql, values = []) => tx.$queryRawUnsafe(sql, ...values);
        const owners = await q(
          "select m.user_id from public.organization_members m join public.roles r on r.id=m.role_id where m.organization_id=$1::uuid and m.status='active' and r.key='owner'",
          [scope.organizationId],
        );
        if (owners.length !== 1)
          throw new SafeError("Choose the import owner explicitly.");
        const before = (
          await q(
            "select md5(string_agg(id::text||arrival_date::text||departure_date::text||adults::text||children::text||status||total_minor::text,',' order by id)) as hash from public.reservations where organization_id=$1::uuid",
            [scope.organizationId],
          )
        )[0].hash;
        const imported = await enrichSmoobu(
          q,
          source,
          profiles,
          conversations,
          scope,
          owners[0].user_id,
        );
        const after = (
          await q(
            "select md5(string_agg(id::text||arrival_date::text||departure_date::text||adults::text||children::text||status||total_minor::text,',' order by id)) as hash from public.reservations where organization_id=$1::uuid",
            [scope.organizationId],
          )
        )[0].hash;
        if (before !== after)
          throw new SafeError("RESERVATIONS_CHANGED_DURING_PROFILE_IMPORT");
        return imported;
      },
      { isolationLevel: "Serializable", timeout: 300000 },
    );
    await fs.writeFile(
      path.join(dir, "profile-import-receipt-" + stamp + ".json"),
      JSON.stringify({
        ...result,
        completedAt: new Date().toISOString(),
        profileFile,
        conversationFile,
      }),
      { mode: 0o600, flag: "wx" },
    );
    console.log(JSON.stringify(result));
  } finally {
    await db.$disconnect();
  }
}
run().catch((error) => {
  console.error(migrationErrorMessage(error));
  process.exitCode = 1;
});

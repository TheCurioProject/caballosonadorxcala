import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), false);
const required = [
  "SUPABASE_DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "CALA_ORGANIZATION_ID",
  "CALA_DEFAULT_PROPERTY_ID",
  "CRON_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "CLOUDINARY_URL",
];
const issues = [];
for (const name of required)
  if (!process.env[name]?.trim()) issues.push(`${name}: missing`);
if (process.env.DATA_BACKEND !== "supabase")
  issues.push("DATA_BACKEND: must be supabase");
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!key) issues.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: missing");
if (key?.startsWith("sb_secret_"))
  issues.push("Supabase public key: a secret key is forbidden");
if (key?.split(".").length === 3) {
  try {
    if (JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role !== "anon")
      issues.push("Supabase public key: only anon/publishable allowed");
  } catch {
    issues.push("Supabase public key: invalid");
  }
}
for (const name of ["CALA_ORGANIZATION_ID", "CALA_DEFAULT_PROPERTY_ID"])
  if (
    process.env[name] &&
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(process.env[name])
  )
    issues.push(`${name}: must be a UUID from bootstrap`);
if (process.env.CRON_SECRET && process.env.CRON_SECRET.length < 32)
  issues.push("CRON_SECRET: use at least 32 random characters");
try {
  const url = new URL(process.env.SUPABASE_DATABASE_URL);
  if (!/^cala_site_app(?:\.|$)/.test(url.username))
    issues.push("SUPABASE_DATABASE_URL: use the private cala_site_app role");
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    issues.push("SUPABASE_DATABASE_URL: must be PostgreSQL");
  if (url.searchParams.get("sslmode") !== "require")
    issues.push("SUPABASE_DATABASE_URL: append sslmode=require");
} catch {
  if (process.env.SUPABASE_DATABASE_URL)
    issues.push("SUPABASE_DATABASE_URL: invalid");
}
if (Number(process.versions.node.split(".")[0]) !== 22)
  issues.push("Use Node.js 22 (see .nvmrc)");
if (issues.length) {
  console.error("Production configuration is incomplete:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(
    "Production variables validated without printing secrets. No remote connection was made.",
  );
  console.log(
    "Before release: apply migrations, bootstrap the owner, reconcile imported counts, test Stripe and email delivery, and schedule iCal/hold expiration. See docs/SUPABASE_SETUP.md.",
  );
}

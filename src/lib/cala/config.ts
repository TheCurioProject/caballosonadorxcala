/** No secret values are returned to the browser. */
export function calaConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_DATABASE_URL",
    "CALA_ORGANIZATION_ID",
    "CALA_DEFAULT_PROPERTY_ID",
  ];
  const missing = required.filter((key) => !env[key]);
  if (!(
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ))
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (env.DATA_BACKEND !== "supabase") missing.push("DATA_BACKEND=supabase");
  return { ready: missing.length === 0, missing };
}
export function supabasePublicConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

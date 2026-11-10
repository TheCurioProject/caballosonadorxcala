import { DomainError } from "@/cala/domain/shared/errors";
export function developmentEnabled(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.NODE_ENV !== "production" &&
    (env.APP_ENV ?? "development") === "development" &&
    !env.VERCEL &&
    !env.CF_PAGES &&
    !env.RENDER
  );
}
export function productionBackendConfigured(
  env: NodeJS.ProcessEnv = process.env,
) {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
export function assertDevelopment() {
  if (!developmentEnabled())
    throw new DomainError(
      "DEVELOPMENT_DISABLED",
      "Los adaptadores de desarrollo están bloqueados en este entorno. Configura los adaptadores de producción.",
      503,
    );
}
export function assertLocalRequest(request: Request) {
  assertDevelopment();
  const host = request.headers.get("host");
  const hostname = host ? new URL(`http://${host}`).hostname : "";
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(hostname) ||
    (forwardedHost !== null && forwardedHost !== host) ||
    (forwardedFor !== null &&
      !forwardedFor
        .split(",")
        .every((ip) =>
          ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip.trim()),
        )) ||
    request.headers.has("forwarded")
  )
    throw new DomainError(
      "LOCAL_ONLY",
      "El almacenamiento local sólo está disponible en loopback.",
      403,
    );
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || new URL(origin).host !== host)
    throw new DomainError(
      "CSRF",
      "La solicitud no procede de este sitio.",
      403,
    );
}

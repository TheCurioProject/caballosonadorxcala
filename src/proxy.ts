import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabasePublicConfig } from "@/lib/cala/config";
import { getSession } from "@/lib/auth";
import type { Database } from "@/cala/infrastructure/db/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname,
    locales = ["es", "en"];
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-app-pathname", path);
  const urlLocale = path.split("/")[1],
    cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  requestHeaders.set(
    "x-app-locale",
    locales.includes(urlLocale)
      ? urlLocale
      : cookieLocale && locales.includes(cookieLocale)
        ? cookieLocale
        : "es",
  );
  const privatePath =
    /^\/(admin(?:\/|$)|api\/(?:cala|admin)(?:\/|$)|uploads\/)/.test(path);
  const publicCalendar = /^\/cala\/disponibilidad\/[a-f0-9]{64}\/?$/.test(path);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  let requestClient: SupabaseClient<Database> | undefined;
  const { url, key } = supabasePublicConfig();
  if (privatePath && url && key) {
    const client = createServerClient<Database>(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          for (const { name, value } of values)
            request.cookies.set(name, value);
          requestHeaders.set("cookie", request.headers.get("cookie") || "");
          const previous = response;
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          for (const cookie of previous.cookies.getAll())
            response.cookies.set(cookie);
          for (const { name, value, options } of values)
            response.cookies.set(name, value, options);
        },
      },
    });
    requestClient = client;
    try {
      await client.auth.getClaims();
    } catch {
      /* Routes verify getUser and active membership. */
    }
  }
  if (path.startsWith("/uploads/") && !(await getSession(requestClient))) {
    const denied = new NextResponse("Unauthorized", { status: 401 });
    for (const cookie of response.cookies.getAll()) denied.cookies.set(cookie);
    return denied;
  }
  if (path.startsWith("/admin") || publicCalendar) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const policy = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://res.cloudinary.com",
      "font-src 'self' data:",
      "worker-src 'self'",
      "manifest-src 'self'",
      `connect-src 'self'${url ? " " + new URL(url).origin : ""}${process.env.NODE_ENV === "development" ? " ws:" : ""}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      publicCalendar ? "frame-ancestors *" : "frame-ancestors 'none'",
    ].join("; ");
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", policy);
    const secured = NextResponse.next({ request: { headers: requestHeaders } });
    for (const cookie of response.cookies.getAll()) secured.cookies.set(cookie);
    response = secured;
    response.headers.set("Content-Security-Policy", policy);
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    if (!publicCalendar) response.headers.set("X-Frame-Options", "DENY");
    else response.headers.set("Referrer-Policy", "no-referrer");
  }
  if (privatePath || publicCalendar)
    response.headers.set("Cache-Control", "private, no-store");
  if (
    path.startsWith("/api") ||
    path.startsWith("/admin") ||
    path.startsWith("/cala/") ||
    path.startsWith("/_next") ||
    path.startsWith("/imagenes") ||
    path.startsWith("/uploads") ||
    path.includes(".")
  )
    return response;
  if (!locales.includes(urlLocale)) {
    const locale =
      cookieLocale && locales.includes(cookieLocale) ? cookieLocale : "es";
    request.nextUrl.pathname = `/${locale}${path === "/" ? "/" : path.endsWith("/") ? path : path + "/"}`;
    const redirect = NextResponse.redirect(request.nextUrl);
    redirect.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return redirect;
  }
  if (cookieLocale !== urlLocale)
    response.cookies.set("NEXT_LOCALE", urlLocale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  return response;
}
export const config = {
  matcher: ["/uploads/:path*", "/admin/:path*", "/((?!_next|.*\\..*).*)"],
};

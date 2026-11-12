import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import "@fontsource-variable/instrument-sans";
import "@/cala/styles/cala.css";
import "@/cala/styles/device-tiers.css";
import "@/cala/styles/planner.css";
import "@/cala/styles/finance.css";
import "@/cala/styles/loading.css";
import { SiteAdmin } from "@/cala/site-admin";
import { CalaSplash } from "@/cala/components/ui/cala-loader";
import { calaConfiguration } from "@/lib/cala/config";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "CALA · Casa Caballo Soñador", template: "%s · CALA" },
  applicationName: "CALA · Casa Caballo Soñador",
  robots: { index: false, follow: false },
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "CALA", statusBarStyle: "default" },
  icons: {
    icon: "/cala/pwa/icon-192.png",
    apple: "/cala/pwa/apple-touch-icon.png",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f2ea",
  interactiveWidget: "resizes-content",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Interface language chosen on the sign-in screen or in Configuración
  // (cookie only; never stored in the database).
  const saved = (await cookies()).get("cala-locale")?.value;
  const locale = saved === "en" || saved === "es" ? saved : undefined;
  const config = calaConfiguration();
  if (!config.ready)
    return (
      <main className="setup-card">
        <img src="/cala/pwa/icon-192.png" width={72} height={72} alt="CALA" />
        <p className="eyebrow">CASA CABALLO SOÑADOR</p>
        <h1>CALA está instalado</h1>
        <p>
          Falta conectar Supabase para iniciar sesión y cargar los datos del
          alojamiento.
        </p>
        <p>
          Completa la guía <code>docs/SUPABASE_SETUP.md</code> y reinicia el
          servidor.
        </p>
        <details>
          <summary>Configuración pendiente</summary>
          <ul>
            {config.missing.map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
        </details>
        <Link className="button secondary" href="/es/">
          Volver a la web
        </Link>
      </main>
    );
  return (
    <Suspense fallback={<CalaSplash />}>
      <SiteAdmin locale={locale}>{children}</SiteAdmin>
    </Suspense>
  );
}

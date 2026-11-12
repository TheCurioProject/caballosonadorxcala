"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LocaleProvider, type Locale } from "@/cala/lib/i18n";
import { PwaProvider } from "@/cala/features/pwa/provider";
import { WorkspaceApp } from "@/cala/features/workspace/app";
import { CalaLoadingLayer } from "@/cala/components/ui/loading-layer";
export function SiteAdmin({
  children,
  locale,
}: {
  children: ReactNode;
  locale?: Locale;
}) {
  const section = usePathname().split("/")[2] || "inicio";
  const legacy = [
    "content",
    "experiencias",
    "writers-group",
    "during-your-stay",
    "servicios-comida",
    "tours-bookings",
    "stripe",
    "settings",
    "integracion",
    "alojamientos",
  ].includes(section);
  return (
    <LocaleProvider initialLocale={locale}>
      <PwaProvider>
        <CalaLoadingLayer />
        <WorkspaceApp section={section === "login" ? "inicio" : section}>
          {legacy ? children : undefined}
        </WorkspaceApp>
      </PwaProvider>
    </LocaleProvider>
  );
}

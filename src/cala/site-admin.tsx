"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LocaleProvider } from "@/cala/lib/i18n";
import { PwaProvider } from "@/cala/features/pwa/provider";
import { WorkspaceApp } from "@/cala/features/workspace/app";
export function SiteAdmin({ children }: { children: ReactNode }) {
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
    <LocaleProvider>
      <PwaProvider>
        <WorkspaceApp section={section === "login" ? "inicio" : section}>
          {legacy ? children : undefined}
        </WorkspaceApp>
      </PwaProvider>
    </LocaleProvider>
  );
}

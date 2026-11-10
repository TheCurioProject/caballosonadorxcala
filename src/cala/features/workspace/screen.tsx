"use client";
import { Guests } from "@/cala/features/guests/screen";
import { Inbox } from "@/cala/features/messaging/screen";
import { Templates } from "@/cala/features/messaging/templates";
import { Market } from "@/cala/features/operations/market";
import { Dashboard } from "@/cala/features/dashboard/screen";
import { Reservations } from "@/cala/features/reservations/screen";
import { Calendar } from "@/cala/features/reservations/calendar";
import { Inventory } from "@/cala/features/inventory/screen";
import { Rates } from "@/cala/features/inventory/rates";
import { Onboarding } from "@/cala/features/onboarding/screen";
import { Channels } from "@/cala/features/integrations/channels";
import { Jobs } from "@/cala/features/integrations/jobs";
import { Operations } from "@/cala/features/operations/screen";
import { Finance } from "@/cala/features/finance/screen";
import { Automations } from "@/cala/features/operations/automation";
import { Reports } from "@/cala/features/operations/reports";
import { Settings, Team } from "@/cala/features/settings/screen";
export function WorkspaceScreen({ section }: { section: string }) {
  switch (section) {
    case "huespedes":
      return <Guests />;
    case "inbox":
      return <Inbox />;
    case "plantillas":
      return <Templates />;
    case "mercado":
      return <Market />;
    case "inicio":
      return <Dashboard />;
    case "reservas":
      return <Reservations />;
    case "calendario":
      return <Calendar />;
    case "inventario":
      return <Inventory />;
    case "tarifas":
      return <Rates />;
    case "onboarding":
      return <Onboarding />;
    case "canales":
      return <Channels />;
    case "actividad":
      return <Jobs />;
    case "limpieza":
      return <Operations kind="housekeeping" />;
    case "mantenimiento":
      return <Operations kind="maintenance" />;
    case "finanzas":
      return <Finance />;
    case "automatizaciones":
      return <Automations />;
    case "reportes":
      return <Reports />;
    case "equipo":
      return <Team />;
    case "ajustes":
      return <Settings />;
    default:
      return <Dashboard />;
  }
}

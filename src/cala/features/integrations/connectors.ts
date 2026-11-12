"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { uiLocale } from "@/cala/lib/format";

export type ConnectorProvider = "airbnb" | "booking" | "vrbo" | "expedia" | "other";

export interface CalendarLinkState {
  id: string;
  unitId: string;
  provider: ConnectorProvider;
  host: string;
  status: "pending" | "ok" | "error";
  lastSyncAt: string | null;
  lastError: string | null;
  eventCount: number;
  blockCount: number;
  conflictCount: number;
  createdAt: string;
}
export interface FeedState {
  unitId: string;
  provider: ConnectorProvider;
  createdAt: string;
  lastFetchedAt: string | null;
  agent: string | null;
  fetchCount: number;
}
export interface InboundEmail {
  id: string;
  kind: "message" | "forwarding" | "bounce" | "other";
  provider: ConnectorProvider | null;
  from: string | null;
  subject: string | null;
  summary: string | null;
  threadId: string | null;
  receivedAt: string;
}
export interface ConnectorState {
  links: CalendarLinkState[];
  feeds: FeedState[];
  inbox: { localPart: string; address?: string; createdAt: string } | null;
  emails: InboundEmail[];
  outbound: { sent: number; failed: number; lastSentAt: string | null };
  mail: { receiving: boolean; webhook: boolean; sending: boolean; domain: string | null };
  webhookUrl: string;
}

export class ConnectorError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export async function connector<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/cala/connectors/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
      cache: "no-store",
    });
  } catch {
    throw new ConnectorError("Sin conexión a internet. Revisa tu red e inténtalo de nuevo.", "OFFLINE");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ConnectorError(
      typeof data.message === "string" ? data.message : "No se pudo completar. Inténtalo de nuevo.",
      typeof data.code === "string" ? data.code : "ERROR",
    );
  return data as T;
}

/** Live connector state; `poll` (ms) keeps it fresh while the assistant waits for proof. */
export function useConnectorState(propertyId: string, poll = 0) {
  const [state, setState] = useState<ConnectorState | null>(null);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const next = await connector<ConnectorState>("state", { propertyId });
      if (alive.current) {
        setState(next);
        setError("");
      }
      return next;
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "No se pudo cargar.");
      return null;
    }
  }, [propertyId]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (!poll) return;
    const t = window.setInterval(() => void refresh(), poll);
    return () => window.clearInterval(t);
  }, [poll, refresh]);
  return { state, error, refresh };
}

/** A fetch by a person's browser is not proof that the OTA reads the feed. */
export function looksLikeBrowser(agent: string | null) {
  if (!agent) return false;
  return /mozilla\/5\.0/i.test(agent) && /(chrome|safari|firefox|edg)\//i.test(agent) && !/(bot|crawler|fetch|airbnb|booking|expedia|vrbo|homeaway|google-calendar|calendar)/i.test(agent);
}

export interface OtaGuide {
  id: ConnectorProvider;
  label: string;
  mark: string;
  hue: number;
  portal: string;
  /** Steps to copy the OTA's export link (OTA → CALA). */
  exportSteps: string[];
  /** Steps to paste CALA's link into the OTA (CALA → OTA). */
  importSteps: string[];
  urlExample: string;
  note?: string;
  /** Domains that send this OTA's guest-message e-mails. */
  mailDomain: string;
}

export const otaGuides: Record<ConnectorProvider, OtaGuide> = {
  airbnb: {
    id: "airbnb",
    label: "Airbnb",
    mark: "A",
    hue: 2,
    portal: "https://www.airbnb.com/multicalendar",
    exportSteps: [
      "Entra a Airbnb como anfitrión y abre «Calendario».",
      "Elige el anuncio que corresponde a esta habitación o casa.",
      "Abre «Disponibilidad» y baja hasta «Conectar calendarios» (o «Sincronizar calendarios»).",
      "Pulsa «Exportar calendario» y copia el enlace (empieza por https://www.airbnb… y termina en .ics).",
    ],
    importSteps: [
      "En la misma sección «Conectar calendarios» pulsa «Importar calendario».",
      "Pega el enlace de CALA en «URL del calendario».",
      "Ponle de nombre «CALA» y pulsa «Importar calendario».",
    ],
    urlExample: "https://www.airbnb.com/calendar/ical/12345678.ics?s=…",
    mailDomain: "airbnb.com",
  },
  booking: {
    id: "booking",
    label: "Booking.com",
    mark: "B",
    hue: 215,
    portal: "https://admin.booking.com",
    exportSteps: [
      "Entra a la Extranet de Booking.com.",
      "Abre «Tarifas y disponibilidad» → «Sincronizar calendarios».",
      "Pulsa «Añadir conexión» y elige el tipo de habitación que corresponde a esta unidad.",
      "Copia el enlace de «Exportar calendario» (empieza por https://admin.booking.com/… o https://ical.booking.com/…).",
    ],
    importSteps: [
      "En esa misma conexión, pega el enlace de CALA en «Importar calendario».",
      "Ponle de nombre «CALA» y pulsa «Guardar» o «Importar».",
    ],
    urlExample: "https://ical.booking.com/v1/export?t=…",
    note: "Booking.com solo permite sincronizar por iCal en habitaciones con una unidad disponible.",
    mailDomain: "booking.com",
  },
  vrbo: {
    id: "vrbo",
    label: "Vrbo",
    mark: "V",
    hue: 225,
    portal: "https://www.vrbo.com/p/calendar",
    exportSteps: [
      "Entra a tu panel de Vrbo y abre «Calendario» del anuncio.",
      "Pulsa «Importar y exportar» (Import/Export).",
      "Elige «Exportar» y copia el enlace del calendario.",
    ],
    importSteps: [
      "En «Importar y exportar», elige «Importar calendario».",
      "Pega el enlace de CALA, ponle de nombre «CALA» y guarda.",
    ],
    urlExample: "https://www.vrbo.com/icalendar/…ics",
    mailDomain: "vrbo.com",
  },
  expedia: {
    id: "expedia",
    label: "Expedia",
    mark: "E",
    hue: 48,
    portal: "https://apps.expediapartnercentral.com",
    exportSteps: [
      "Entra a Expedia Partner Central.",
      "Abre «Habitaciones y tarifas» → «Disponibilidad» → «Sincronización de calendario».",
      "Copia el enlace de exportación del calendario.",
    ],
    importSteps: ["En la misma pantalla, pega el enlace de CALA en «Importar calendario» y guarda."],
    urlExample: "https://…expedia…/calendar.ics",
    note: "Expedia solo ofrece iCal en alquileres vacacionales; los hoteles necesitan un channel manager certificado.",
    mailDomain: "expedia.com",
  },
  other: {
    id: "other",
    label: "Otro calendario",
    mark: "•",
    hue: 260,
    portal: "",
    exportSteps: [
      "En la plataforma, busca «Exportar calendario», «iCal» o «Sincronizar calendario».",
      "Copia el enlace (debe empezar por https:// y suele terminar en .ics).",
    ],
    importSteps: ["En la misma plataforma, busca «Importar calendario» y pega el enlace de CALA."],
    urlExample: "https://…/calendar.ics",
    mailDomain: "",
  },
};
export const otaOrder: ConnectorProvider[] = ["airbnb", "booking", "vrbo", "expedia", "other"];

export function timeAgo(iso: string | null, now = Date.now()) {
  if (!iso) return "";
  const min = Math.round((now - Date.parse(iso)) / 60000);
  const rtf = new Intl.RelativeTimeFormat(uiLocale(), { numeric: "auto" });
  if (min < 1) return rtf.format(0, "minute");
  if (min < 60) return rtf.format(-min, "minute");
  const h = Math.round(min / 60);
  if (h < 48) return rtf.format(-h, "hour");
  return rtf.format(-Math.round(h / 24), "day");
}

/** "Airbnb y Booking.com" / "Airbnb and Booking.com" in the interface language. */
export function listOf(items: string[], type: "conjunction" | "disjunction" = "conjunction") {
  return new Intl.ListFormat(uiLocale(), { style: "long", type }).format(items);
}

import type { Channel } from "../model";

export type OtaProvider =
  | "airbnb"
  | "booking"
  | "expedia"
  | "vrbo"
  | "google"
  | "tripadvisor";

export type OtaInfo = {
  id: OtaProvider;
  label: string;
  /** One-letter mark for avatars and badges. */
  mark: string;
  /** Hue used for the badge (works on light and dark themes). */
  hue: number;
  portal: { label: string; url: string };
  /** Checklist the host completes inside the OTA before linking. */
  prepare: string[];
  account: { label: string; hint: string; pattern: RegExp; example: string };
  listing: { label: string; hint: string; pattern: RegExp; example: string };
  messaging: string;
};

export const otaCatalog: Record<OtaProvider, OtaInfo> = {
  airbnb: {
    id: "airbnb",
    label: "Airbnb",
    mark: "A",
    hue: 2,
    portal: { label: "Abrir Airbnb (anfitrión)", url: "https://www.airbnb.com/hosting" },
    prepare: [
      "Tienes una cuenta de anfitrión con al menos un anuncio publicado.",
      "En Airbnb: Cuenta → Configuración profesional → Software de terceros. Ahí autorizarás a CALA cuando el conector esté activo.",
      "Copia el número de cada anuncio: aparece en la URL airbnb.com/rooms/«número».",
    ],
    account: {
      label: "Correo o ID de anfitrión",
      hint: "El correo con el que entras a Airbnb o tu ID de anfitrión (perfil → URL).",
      pattern: /^([^\s@]+@[^\s@]+\.[^\s@]+|\d{4,20})$/,
      example: "anfitrion@correo.com",
    },
    listing: {
      label: "ID del anuncio",
      hint: "Solo números, tal como aparece en airbnb.com/rooms/…",
      pattern: /^\d{5,20}$/,
      example: "53812749",
    },
    messaging:
      "Los mensajes de huéspedes de Airbnb llegarán a esta bandeja y tus respuestas saldrán por el chat de Airbnb.",
  },
  booking: {
    id: "booking",
    label: "Booking.com",
    mark: "B",
    hue: 215,
    portal: { label: "Abrir Extranet de Booking.com", url: "https://admin.booking.com" },
    prepare: [
      "Tienes acceso de administrador a la Extranet de tu alojamiento.",
      "En la Extranet: Cuenta → Proveedor de conectividad. Busca a tu proveedor y acepta los términos cuando el conector esté activo.",
      "Anota el ID de tu alojamiento (arriba en la Extranet) y el ID de cada tipo de habitación (Propiedad → Detalles de las habitaciones).",
    ],
    account: {
      label: "ID del alojamiento (Hotel ID)",
      hint: "Número de 6 a 9 dígitos que aparece junto al nombre en la Extranet.",
      pattern: /^\d{5,12}$/,
      example: "8123456",
    },
    listing: {
      label: "ID del tipo de habitación",
      hint: "Número del tipo de habitación en la Extranet.",
      pattern: /^\d{5,14}$/,
      example: "812345601",
    },
    messaging:
      "Los mensajes de la Extranet (y del huésped) se centralizan aquí; las respuestas se envían por la mensajería de Booking.com.",
  },
  expedia: {
    id: "expedia",
    label: "Expedia",
    mark: "E",
    hue: 48,
    portal: { label: "Abrir Expedia Partner Central", url: "https://apps.expediapartnercentral.com" },
    prepare: [
      "Tienes acceso a Expedia Partner Central como administrador.",
      "En Partner Central: Configuración → Proveedor de conectividad. Solicita el cambio cuando el conector esté activo.",
      "Anota el Property ID y el ID de cada tipo de habitación (Habitaciones y tarifas).",
    ],
    account: {
      label: "Property ID",
      hint: "Número que aparece en la parte superior de Partner Central.",
      pattern: /^\d{3,12}$/,
      example: "45612378",
    },
    listing: {
      label: "ID del tipo de habitación",
      hint: "Número del tipo de habitación en Partner Central.",
      pattern: /^\d{3,14}$/,
      example: "201845632",
    },
    messaging:
      "Los mensajes de huéspedes de Expedia y Hotels.com se centralizan en esta bandeja.",
  },
  vrbo: {
    id: "vrbo",
    label: "Vrbo",
    mark: "V",
    hue: 225,
    portal: { label: "Abrir panel de Vrbo", url: "https://www.vrbo.com/p" },
    prepare: [
      "Tienes una cuenta de propietario con el anuncio activo.",
      "En Vrbo: Configuración → Software de gestión. Ahí autorizarás la conexión cuando el conector esté activo.",
      "Copia el número de cada anuncio (aparece en la URL vrbo.com/«número»).",
    ],
    account: {
      label: "Correo de la cuenta",
      hint: "El correo con el que gestionas tus anuncios.",
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      example: "propietario@correo.com",
    },
    listing: {
      label: "ID del anuncio",
      hint: "Números (y puntos) tal como aparecen en la URL del anuncio.",
      pattern: /^[\d.]{5,30}$/,
      example: "3245871",
    },
    messaging: "Las consultas y mensajes de Vrbo llegarán a esta bandeja.",
  },
  google: {
    id: "google",
    label: "Google Hotels",
    mark: "G",
    hue: 140,
    portal: { label: "Abrir Google Hotel Center", url: "https://www.google.com/hotels/hotelcenter" },
    prepare: [
      "Tu alojamiento aparece en Google Maps y tienes acceso a Hotel Center.",
      "En Hotel Center: Configuración → Socios de conectividad. Vincula a tu proveedor cuando el conector esté activo.",
      "Anota el ID de propiedad de Hotel Center.",
    ],
    account: {
      label: "ID de Hotel Center",
      hint: "Identificador de tu cuenta en Google Hotel Center.",
      pattern: /^[\w-]{3,64}$/,
      example: "casa-caballo-sonador",
    },
    listing: {
      label: "ID de la unidad",
      hint: "Identificador de la habitación o unidad en Hotel Center.",
      pattern: /^[\w-]{1,64}$/,
      example: "villa-1",
    },
    messaging:
      "Google no tiene chat con huéspedes: las reservas directas desde Google se responden por correo desde esta bandeja.",
  },
  tripadvisor: {
    id: "tripadvisor",
    label: "Tripadvisor",
    mark: "T",
    hue: 160,
    portal: { label: "Abrir Tripadvisor Owners", url: "https://www.tripadvisor.com/Owners" },
    prepare: [
      "Eres propietario verificado del alojamiento en Tripadvisor.",
      "En Tripadvisor Owners: Gestionar → Conectividad. Elige a tu proveedor cuando el conector esté activo.",
      "Copia el ID del alojamiento (la «d» seguida de números en la URL).",
    ],
    account: {
      label: "ID del alojamiento",
      hint: "Aparece en la URL: …-d1234567-…",
      pattern: /^d?\d{4,12}$/i,
      example: "d1234567",
    },
    listing: {
      label: "ID de la unidad",
      hint: "Número de la unidad o habitación en Tripadvisor.",
      pattern: /^\w{1,40}$/,
      example: "1",
    },
    messaging: "Las consultas de Tripadvisor llegarán a esta bandeja.",
  },
};

export const otaList = Object.values(otaCatalog);

/** Best-effort match of a reservation source ("Airbnb", "booking.com", "ical:vrbo"…). */
export function providerForSource(source: string): OtaProvider | null {
  const s = source.toLowerCase();
  if (s.includes("airbnb")) return "airbnb";
  if (s.includes("booking")) return "booking";
  if (s.includes("expedia") || s.includes("hotels.com")) return "expedia";
  if (s.includes("vrbo") || s.includes("homeaway")) return "vrbo";
  if (s.includes("google")) return "google";
  if (s.includes("tripadvisor")) return "tripadvisor";
  return null;
}

export function sourceLabel(source: string) {
  const p = providerForSource(source);
  if (p) return otaCatalog[p].label;
  if (["direct", "website", "web"].includes(source.toLowerCase()))
    return "Directa";
  return source;
}

/** Active (not disconnected) connection for a provider at a property. */
export function connectionFor(
  channels: Channel[],
  propertyId: string,
  provider: OtaProvider | null,
) {
  if (!provider) return undefined;
  return channels.find(
    (c) =>
      c.propertyId === propertyId &&
      c.provider === provider &&
      c.status !== "disconnected",
  );
}

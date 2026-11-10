export const AMENITY_KEYS = [
  "wifi",
  "free_parking",
  "pool",
  "air_conditioning",
  "heating",
  "kitchen",
  "hot_tub",
  "washer",
  "dryer",
  "tv",
  "bbq",
  "self_check_in",
  "breakfast",
  "restaurant",
  "bar",
  "front_desk_24h",
  "daily_housekeeping",
  "airport_shuttle",
  "gym",
  "elevator",
  "workspace",
  "pets_allowed",
  "step_free_access",
  "smoke_co_alarm",
] as const;

export type AmenityKey = (typeof AMENITY_KEYS)[number];
export type AmenityCategory = "popular" | "services" | "comfort" | "safety";

type AmenityMeta = {
  label: string;
  category: AmenityCategory;
};

const amenityMeta: Record<AmenityKey, AmenityMeta> = {
  wifi: { label: "Wi-Fi", category: "popular" },
  free_parking: { label: "Estacionamiento gratuito", category: "popular" },
  pool: { label: "Alberca", category: "popular" },
  air_conditioning: { label: "Aire acondicionado", category: "popular" },
  heating: { label: "Calefacción", category: "popular" },
  kitchen: { label: "Cocina", category: "popular" },
  hot_tub: { label: "Jacuzzi", category: "popular" },
  washer: { label: "Lavadora", category: "comfort" },
  dryer: { label: "Secadora", category: "comfort" },
  tv: { label: "TV", category: "comfort" },
  bbq: { label: "Asador", category: "comfort" },
  self_check_in: { label: "Auto check-in", category: "popular" },
  breakfast: { label: "Desayuno incluido", category: "services" },
  restaurant: { label: "Restaurante", category: "services" },
  bar: { label: "Bar", category: "services" },
  front_desk_24h: { label: "Recepción 24 horas", category: "services" },
  daily_housekeeping: { label: "Limpieza diaria", category: "services" },
  airport_shuttle: { label: "Traslado al aeropuerto", category: "services" },
  gym: { label: "Gimnasio", category: "comfort" },
  elevator: { label: "Elevador", category: "comfort" },
  workspace: { label: "Espacio de trabajo", category: "comfort" },
  pets_allowed: { label: "Admite mascotas", category: "comfort" },
  step_free_access: { label: "Acceso sin escalones", category: "safety" },
  smoke_co_alarm: { label: "Detectores de humo y CO", category: "safety" },
};

export const AMENITY_CATEGORIES: ReadonlyArray<{
  key: AmenityCategory;
  label: string;
}> = [
  { key: "popular", label: "Lo más buscado" },
  { key: "services", label: "Servicios" },
  { key: "comfort", label: "Confort y espacios" },
  { key: "safety", label: "Accesibilidad y seguridad" },
];

export const amenityCatalog = AMENITY_KEYS.map((key) => ({
  key,
  ...amenityMeta[key],
}));

export function amenityLabel(key: AmenityKey) {
  return amenityMeta[key].label;
}

export function parseAmenityKeys(value: string): AmenityKey[] {
  const selected = new Set<AmenityKey>();
  for (const item of value.split(",").map((entry) => entry.trim())) {
    const match = amenityCatalog.find(
      (amenity) => amenity.key === item || amenity.label === item,
    );
    if (match) selected.add(match.key);
  }
  return [...selected];
}

const regionLabels: Record<string, string> = {
  Africa: "África",
  America: "América",
  Antarctica: "Antártida",
  Arctic: "Ártico",
  Asia: "Asia",
  Atlantic: "Atlántico",
  Australia: "Australia",
  Europe: "Europa",
  Indian: "Océano Índico",
  Pacific: "Pacífico",
  Etc: "Otras zonas",
  UTC: "Tiempo universal",
};
const regionLabelsEn: Record<string, string> = {
  Africa: "Africa",
  America: "Americas",
  Antarctica: "Antarctica",
  Arctic: "Arctic",
  Asia: "Asia",
  Atlantic: "Atlantic",
  Australia: "Australia",
  Europe: "Europe",
  Indian: "Indian Ocean",
  Pacific: "Pacific",
  Etc: "Other zones",
  UTC: "Universal time",
};

function timeZoneOffset(timeZone: string, locale = "es-MX") {
  const value = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;
  return value?.replace("GMT", "UTC") ?? "UTC";
}

function timeZoneName(timeZone: string, locale = "es-MX") {
  if (timeZone === "UTC")
    return locale.startsWith("en") ? "Universal time" : "Tiempo universal";
  return timeZone.split("/").slice(1).join(" · ").replaceAll("_", " ");
}

const supportedTimeZones =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["America/Mexico_City", "America/New_York", "Europe/Madrid"];

function localizedTimeZoneOptions(locale: "es" | "en") {
  const intl = locale === "en" ? "en-US" : "es-MX";
  return [...new Set(["UTC", ...supportedTimeZones])].map((value) => ({
    value,
    region: value.split("/")[0] || "UTC",
    label: `${timeZoneOffset(value, intl)} · ${timeZoneName(value, intl)}`,
  }));
}

export const timeZoneOptions = localizedTimeZoneOptions("es");

const groupedTimeZones = timeZoneOptions.reduce<
  Record<string, typeof timeZoneOptions>
>((groups, option) => {
  (groups[option.region] ??= []).push(option);
  return groups;
}, {});

export const timeZoneGroups = Object.entries(groupedTimeZones)
  .map(([region, options]) => ({
    region,
    label: regionLabels[region] ?? region,
    options,
  }))
  .sort((a, b) => a.label.localeCompare(b.label, "es"));

export function getTimeZoneGroups(locale: "es" | "en") {
  const options = localizedTimeZoneOptions(locale);
  const grouped = options.reduce<Record<string, typeof options>>(
    (groups, option) => {
      (groups[option.region] ??= []).push(option);
      return groups;
    },
    {},
  );
  const labels = locale === "en" ? regionLabelsEn : regionLabels;
  return Object.entries(grouped)
    .map(([region, entries]) => ({
      region,
      label: labels[region] ?? region,
      options: entries,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

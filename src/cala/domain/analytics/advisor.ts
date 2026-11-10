/**
 * CALA market agent: a deterministic analyst (no generative model, no network,
 * runs wherever the workspace snapshot is — browser or serverless function).
 *
 *   1. Investigate: niche profile, demand calendar, competitor sample.
 *   2. Analyze: history and on-the-books pace from the PMS.
 *   3. Recommend: rules from the knowledge bank, ranked by impact, each with
 *      its evidence and the CALA screen where to act.
 *
 * Every text is a Spanish i18n key with {values}; advisorEnglish holds the
 * English versions.
 */
import type { Snapshot } from "@/cala/domain/model";
import { performance } from "./performance";
import { marketSummary } from "./market";
import { resources } from "../inventory/availability";
import { addDays } from "../shared/dates";
import {
  niches,
  demandOn,
  isLowSeason,
  type NicheProfile,
} from "./advisor-knowledge";

export type Area =
  | "precio"
  | "disponibilidad"
  | "distribucion"
  | "demanda"
  | "huespedes"
  | "datos";
export interface Recommendation {
  id: string;
  area: Area;
  priority: 1 | 2 | 3; // 1 = act now
  confidence: "alta" | "media" | "baja";
  title: string;
  why: string;
  action: string;
  values: Record<string, string | number>;
  evidence: Array<{ label: string; value: string }>;
  href?: string;
  cta?: string;
}
export interface AdvisorStep {
  label: string;
  detail: string;
  values: Record<string, string | number>;
}
export interface AdvisorReport {
  niche: NicheProfile;
  steps: AdvisorStep[];
  metrics: Array<{ label: string; value: string; hint?: string }>;
  recommendations: Recommendation[];
  generatedAt: string;
}

const pct = (n: number | null) =>
  n === null ? "—" : `${Math.round(n * 100)}%`;
const active = ["pending", "confirmed", "checked_in", "checked_out"];

export function runAdvisor(
  data: Snapshot,
  money: (minor: number) => string,
): AdvisorReport {
  const propertyId = data.currentPropertyId;
  const property = data.properties.find((p) => p.id === propertyId);
  const niche = niches[property?.concept ?? "other"] ?? niches.other;
  const today = data.today;
  const units = data.units.filter((u) => u.propertyId === propertyId && u.active);
  const types = data.inventoryTypes.filter((t) => t.propertyId === propertyId);
  const plan = data.ratePlans.find((p) => p.propertyId === propertyId);
  const reservations = data.reservations.filter(
    (r) => r.propertyId === propertyId,
  );
  const safe = <T,>(fn: () => T): T | null => {
    try {
      return fn();
    } catch {
      return null;
    }
  };
  const past = safe(() =>
    performance(data, { propertyId, start: addDays(today, -90), end: today }),
  );
  const next30 = safe(() =>
    performance(data, { propertyId, start: today, end: addDays(today, 30) }),
  );
  const next90 = safe(() =>
    performance(data, { propertyId, start: today, end: addDays(today, 90) }),
  );
  const market = marketSummary(
    data.marketObservations.filter((r) => r.propertyId === propertyId),
    addDays(today, -60),
    addDays(today, 90),
    property?.currency ?? "MXN",
    today,
  );
  const priceOn = (typeId: string, date: string) => {
    const t = types.find((x) => x.id === typeId);
    const d = data.rateDays.find(
      (x) =>
        x.inventoryTypeId === typeId &&
        x.ratePlanId === plan?.id &&
        x.date === date,
    );
    return {
      amount: d && d.amountMinor > 0 ? d.amountMinor : (t?.baseRateMinor ?? 0),
      custom: Boolean(d && d.amountMinor > 0),
      minStay: d?.minStay ?? 1,
      closed: d?.closed ?? false,
    };
  };

  // Occupied/blocked nights per physical resource (handles house ⇄ rooms).
  const busy = new Map<string, Set<string>>();
  const mark = (unitId: string | null, from: string, to: string) => {
    if (!unitId) return;
    for (const id of resources(data, unitId))
      for (let d = from; d < to; d = addDays(d, 1)) {
        if (!busy.has(id)) busy.set(id, new Set());
        busy.get(id)!.add(d);
      }
  };
  for (const r of reservations)
    if (active.includes(r.status)) mark(r.unitId, r.arrival, r.departure);
  for (const b of data.blocks)
    if (b.propertyId === propertyId && b.active)
      mark(b.unitId, b.arrival, b.departure);

  const steps: AdvisorStep[] = [
    {
      label: "Investigando el nicho",
      detail: "{niche}: {guests}. Ocupación sana de referencia: {target}.",
      values: {
        niche: niche.label,
        guests: niche.guests,
        target: pct(niche.targetOccupancy),
      },
    },
    {
      label: "Revisando la competencia",
      detail: market.observations.length
        ? "{count} observaciones de mercado comparables: ADR {adr}, ocupación {occ}."
        : "Sin datos de competencia importados; se usan referencias del nicho y temporada.",
      values: {
        count: market.observations.length,
        adr: market.adrMinor === null ? "—" : money(market.adrMinor),
        occ: pct(market.occupancy),
      },
    },
    {
      label: "Estudiando tu historial",
      detail:
        "{bookings} reservas en los últimos 90 días, ocupación {occ}, tarifa media {adr}.",
      values: {
        bookings: past?.bookings ?? 0,
        occ: pct(past?.occupancy ?? null),
        adr: past?.adrMinor ? money(past.adrMinor) : "—",
      },
    },
    {
      label: "Midiendo el ritmo de reservas",
      detail: "Próximos 30 días: {n30} reservado · próximos 90 días: {n90}.",
      values: {
        n30: pct(next30?.occupancy ?? null),
        n90: pct(next90?.occupancy ?? null),
      },
    },
  ];

  const recs: Recommendation[] = [];
  const href = {
    rates: "/admin/tarifas",
    calendar: "/admin/calendario",
    templates: "/admin/plantillas",
    guests: "/admin/huespedes",
    inventory: "/admin/inventario",
    channels: "/admin/canales",
    market: "/admin/mercado",
  };

  // 1. Pace for the next 30 days.
  if (next30 && next30.occupancy !== null && next30.capacity > 0) {
    const empty = next30.days.filter(
      (d) => d.occupied + d.blocked < d.capacity,
    ).length;
    if (next30.occupancy < 0.35)
      recs.push({
        id: "pace-low",
        area: "demanda",
        priority: 1,
        confidence: "alta",
        title: "El próximo mes está flojo",
        why: "Solo {occ} de las noches de los próximos 30 días están vendidas y hay {empty} días con espacio libre.",
        action:
          "Baja la estancia mínima a 1 noche entre semana, aplica 10–15 % de descuento a las noches libres de los próximos 14 días y comparte una oferta directa con huéspedes anteriores.",
        values: { occ: pct(next30.occupancy), empty },
        evidence: [
          { label: "Ocupación 30 días", value: pct(next30.occupancy) },
          { label: "Días con espacio", value: String(empty) },
        ],
        href: href.rates,
        cta: "Ajustar tarifas",
      });
    else if (next30.occupancy > 0.8)
      recs.push({
        id: "pace-high",
        area: "precio",
        priority: 1,
        confidence: "alta",
        title: "Alta demanda: estás vendiendo rápido",
        why: "Ya tienes {occ} del próximo mes vendido. Las noches que quedan valen más.",
        action:
          "Sube 10–15 % las noches libres de los próximos 30 días y pide estancia mínima de 2 noches para no dejar huecos.",
        values: { occ: pct(next30.occupancy) },
        evidence: [{ label: "Ocupación 30 días", value: pct(next30.occupancy) }],
        href: href.rates,
        cta: "Ajustar tarifas",
      });
  }

  // 2. High-demand dates still at base price.
  const peakNights: Array<{ date: string; label: string }> = [];
  for (let i = 0; i < 150; i++) {
    const date = addDays(today, i);
    const period = demandOn(date);
    if (!period || period.level !== "alta") continue;
    if (types.some((t) => !priceOn(t.id, date).custom))
      peakNights.push({ date, label: period.label });
  }
  if (peakNights.length) {
    const labels = [...new Set(peakNights.map((p) => p.label))].slice(0, 3);
    recs.push({
      id: "peak-underpriced",
      area: "precio",
      priority: 1,
      confidence: "media",
      title: "Temporada alta con precio base",
      why: "{count} noches de {periods} siguen con la tarifa base. En tu nicho estas fechas se venden antes y a mejor precio.",
      action:
        "Sube 20–30 % esas fechas en Tarifas y fija una estancia mínima de {minStay} noches.",
      values: {
        count: peakNights.length,
        periods: labels.join(", "),
        minStay: Math.max(niche.weekendMinStay, 3),
      },
      evidence: [
        { label: "Primera fecha", value: peakNights[0].date },
        { label: "Noches sin precio propio", value: String(peakNights.length) },
      ],
      href: href.rates,
      cta: "Abrir Tarifas",
    });
  }

  // 3. Orphan gaps (1–2 free nights between stays) in the next 60 days.
  let orphans = 0;
  let blockedByMinStay = 0;
  for (const u of units) {
    const leafs = [...resources(data, u.id)];
    const isBusy = (d: string) => leafs.some((id) => busy.get(id)?.has(d));
    let run: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const d = addDays(today, i);
      if (!isBusy(d)) run.push(d);
      else {
        if (run.length && run.length <= 2 && run[0] !== today && isBusy(addDays(run[0], -1))) {
          orphans++;
          if (priceOn(u.inventoryTypeId, run[0]).minStay > run.length)
            blockedByMinStay++;
        }
        run = [];
      }
    }
  }
  if (orphans)
    recs.push({
      id: "orphans",
      area: "disponibilidad",
      priority: blockedByMinStay ? 1 : 2,
      confidence: "alta",
      title: "Huecos cortos entre estancias",
      why: "Hay {count} huecos de 1–2 noches entre reservas en los próximos 60 días; {blocked} no se pueden vender por la estancia mínima.",
      action:
        "Baja la estancia mínima solo en esas fechas y ofrécelas con 15 % de descuento como extensión a los huéspedes que llegan o salen.",
      values: { count: orphans, blocked: blockedByMinStay },
      evidence: [
        { label: "Huecos", value: String(orphans) },
        { label: "Bloqueados por estancia mínima", value: String(blockedByMinStay) },
      ],
      href: href.calendar,
      cta: "Ver calendario",
    });

  // 4. Weekday vs weekend.
  const days = [...(past?.days ?? []), ...(next90?.days ?? [])];
  const share = (pick: (dow: number) => boolean) => {
    const set = days.filter((d) =>
      pick(new Date(d.date + "T12:00:00Z").getUTCDay()),
    );
    const cap = set.reduce((n, d) => n + d.capacity, 0);
    return cap ? set.reduce((n, d) => n + d.occupied, 0) / cap : null;
  };
  const weekend = share((d) => d === 5 || d === 6);
  const weekday = share((d) => d >= 0 && d <= 4);
  if (weekend !== null && weekday !== null && weekend - weekday > 0.25)
    recs.push({
      id: "weekday-gap",
      area: "demanda",
      priority: 2,
      confidence: "media",
      title: "Los fines de semana se llenan, entre semana no",
      why: "Ocupación de viernes y sábado {weekend} contra {weekday} de domingo a jueves.",
      action:
        "Precio diferenciado: +10 % viernes y sábado, −10 % de domingo a jueves, y un paquete de 3 noches entre semana (por ejemplo con comida o tour).",
      values: { weekend: pct(weekend), weekday: pct(weekday) },
      evidence: [
        { label: "Fin de semana", value: pct(weekend) },
        { label: "Entre semana", value: pct(weekday) },
      ],
      href: href.rates,
      cta: "Ajustar tarifas",
    });

  // 5. Price vs competitors.
  if (market.adrMinor && past?.adrMinor && market.occupancy !== null) {
    const ratio = past.adrMinor / market.adrMinor;
    if (ratio < 0.9 && (past.occupancy ?? 0) >= market.occupancy)
      recs.push({
        id: "below-market",
        area: "precio",
        priority: 1,
        confidence: market.observations.length >= 20 ? "alta" : "media",
        title: "Cobras menos que tu competencia",
        why: "Tu tarifa media es {own} y la del mercado {market} ({ratio} del mercado) con igual o mejor ocupación.",
        action: "Sube tus tarifas 5–10 % y revisa la ocupación en dos semanas.",
        values: {
          own: money(past.adrMinor),
          market: money(market.adrMinor),
          ratio: pct(ratio),
        },
        evidence: [
          { label: "Tu ADR", value: money(past.adrMinor) },
          { label: "ADR del mercado", value: money(market.adrMinor) },
        ],
        href: href.rates,
        cta: "Ajustar tarifas",
      });
    else if (ratio > 1.1 && (past.occupancy ?? 0) < market.occupancy - 0.1)
      recs.push({
        id: "above-market",
        area: "precio",
        priority: 1,
        confidence: market.observations.length >= 20 ? "alta" : "media",
        title: "Precio alto para tu ocupación",
        why: "Tu tarifa media ({own}) está {ratio} del mercado, pero tu ocupación ({occ}) va por debajo de la competencia ({marketOcc}).",
        action:
          "Baja 5–8 % las noches libres de los próximos 45 días o añade valor (desayuno, traslado) sin bajar precio.",
        values: {
          own: money(past.adrMinor),
          ratio: pct(ratio),
          occ: pct(past.occupancy),
          marketOcc: pct(market.occupancy),
        },
        evidence: [
          { label: "Tu ocupación", value: pct(past.occupancy) },
          { label: "Ocupación del mercado", value: pct(market.occupancy) },
        ],
        href: href.rates,
        cta: "Ajustar tarifas",
      });
  }

  // 6. Direct bookings.
  const recent = reservations.filter(
    (r) => r.createdAt >= addDays(today, -180) && r.status !== "draft",
  );
  const direct = recent.length
    ? recent.filter((r) => ["direct", "website"].includes(r.source)).length /
      recent.length
    : null;
  if (direct !== null && recent.length >= 5 && direct < niche.directShareGoal)
    recs.push({
      id: "direct-share",
      area: "distribucion",
      priority: 2,
      confidence: "media",
      title: "Pocas reservas directas",
      why: "Solo {share} de tus reservas recientes son directas; en tu nicho lo sano es {goal} o más. Cada reserva directa ahorra la comisión de la OTA.",
      action:
        "Envía a tus huéspedes anteriores una plantilla con un código de regreso y destaca en la web los extras que las OTAs no ofrecen.",
      values: { share: pct(direct), goal: pct(niche.directShareGoal) },
      evidence: [
        { label: "Directas (180 días)", value: pct(direct) },
        { label: "Reservas analizadas", value: String(recent.length) },
      ],
      href: href.templates,
      cta: "Crear plantilla",
    });

  // 7. Returning guests.
  const stays = new Map<string, number>();
  for (const r of reservations)
    if (r.status === "checked_out" || r.departure < today)
      stays.set(r.guestId, (stays.get(r.guestId) ?? 0) + 1);
  const pastGuests = stays.size;
  if (pastGuests >= 5)
    recs.push({
      id: "returning",
      area: "huespedes",
      priority: 3,
      confidence: "media",
      title: "Tus huéspedes anteriores son tu mejor canal",
      why: "Tienes {count} huéspedes que ya se hospedaron. Volver a contactarlos cuesta menos que atraer nuevos.",
      action:
        "Antes de cada temporada alta, envía una invitación con prioridad de fechas y 5–10 % de descuento directo.",
      values: { count: pastGuests },
      evidence: [{ label: "Huéspedes con estancias", value: String(pastGuests) }],
      href: href.guests,
      cta: "Ver huéspedes",
    });

  // 8. Cancellations.
  if (
    past?.cancellationRate !== null &&
    past?.cancellationRate !== undefined &&
    past.cancellationRate > niche.maxCancellation
  )
    recs.push({
      id: "cancellations",
      area: "distribucion",
      priority: 2,
      confidence: "media",
      title: "Demasiadas cancelaciones",
      why: "{rate} de las llegadas recientes se cancelaron (referencia del nicho: menos de {max}).",
      action:
        "Pide un anticipo no reembolsable en temporada alta y ofrece una tarifa flexible algo más cara para quien quiera cancelar.",
      values: {
        rate: pct(past.cancellationRate),
        max: pct(niche.maxCancellation),
      },
      evidence: [{ label: "Cancelaciones", value: pct(past.cancellationRate) }],
      href: href.rates,
      cta: "Revisar planes",
    });

  // 9. Lead time.
  if (past?.averageLeadDays !== null && past?.averageLeadDays !== undefined) {
    if (past.averageLeadDays < 10)
      recs.push({
        id: "lead-short",
        area: "demanda",
        priority: 3,
        confidence: "media",
        title: "Tus huéspedes reservan a última hora",
        why: "Reservan en promedio {days} días antes de llegar.",
        action:
          "No bajes precios con mucha anticipación: espera a 7–10 días antes para aplicar descuentos a noches libres y mantén el calendario abierto al menos 12 meses.",
        values: { days: past.averageLeadDays.toFixed(1) },
        evidence: [
          { label: "Anticipación media", value: past.averageLeadDays.toFixed(1) },
        ],
        href: href.rates,
        cta: "Abrir Tarifas",
      });
    else if (past.averageLeadDays > 45)
      recs.push({
        id: "lead-long",
        area: "demanda",
        priority: 3,
        confidence: "media",
        title: "Te reservan con mucha anticipación",
        why: "Reservan en promedio {days} días antes. Hay espacio para subir las fechas cercanas.",
        action:
          "Ofrece un descuento por reserva anticipada (60+ días) y sube 5–10 % las noches que quedan libres a menos de 30 días.",
        values: { days: past.averageLeadDays.toFixed(1) },
        evidence: [
          { label: "Anticipación media", value: past.averageLeadDays.toFixed(1) },
        ],
        href: href.rates,
        cta: "Abrir Tarifas",
      });
  }

  // 10. Weakest unit vs the property.
  if (units.length > 1) {
    const window = 90;
    const occ = units
      .map((u) => {
        const leafs = [...resources(data, u.id)];
        let sold = 0;
        for (let i = -45; i < window - 45; i++) {
          const d = addDays(today, i);
          if (leafs.every((id) => busy.get(id)?.has(d))) sold++;
        }
        return { unit: u, rate: sold / window };
      })
      .filter((x) => !data.units.some((c) => c.parentUnitId === x.unit.id));
    const avg = occ.reduce((n, x) => n + x.rate, 0) / (occ.length || 1);
    const weakest = occ.sort((a, b) => a.rate - b.rate)[0];
    if (weakest && avg > 0.15 && weakest.rate < avg * 0.5)
      recs.push({
        id: "weak-unit",
        area: "precio",
        priority: 2,
        confidence: "media",
        title: "{unit} se vende menos que las demás",
        why: "{unit} tiene {occ} de ocupación contra {avg} del resto de la propiedad.",
        action:
          "Revisa sus fotos y descripción en «Alojamientos y página web» y prueba un precio 8–10 % menor durante un mes.",
        values: {
          unit: weakest.unit.name,
          occ: pct(weakest.rate),
          avg: pct(avg),
        },
        evidence: [
          { label: "Ocupación de la unidad", value: pct(weakest.rate) },
          { label: "Promedio de la propiedad", value: pct(avg) },
        ],
        href: href.inventory,
        cta: "Abrir inventario",
      });
  }

  // 11. Whole house vs rooms pricing (entire home sold alongside rooms).
  const parent = units.find((u) => data.units.some((c) => c.parentUnitId === u.id));
  if (parent) {
    const children = units.filter((u) => u.parentUnitId === parent.id);
    const date = addDays(today, 14);
    const home = priceOn(parent.inventoryTypeId, date).amount;
    const roomsTotal = children.reduce(
      (n, c) => n + priceOn(c.inventoryTypeId, date).amount,
      0,
    );
    if (children.length > 1 && home > 0 && roomsTotal > 0 && home < roomsTotal * 0.85)
      recs.push({
        id: "home-vs-rooms",
        area: "precio",
        priority: 2,
        confidence: "alta",
        title: "La casa completa vale menos que sus habitaciones",
        why: "La casa completa cuesta {home} por noche, pero sus {rooms} habitaciones juntas suman {total}. Venderla bloquea todas las habitaciones.",
        action:
          "Pon la casa completa al menos al 90 % de la suma de habitaciones y pide 2–3 noches mínimas para que compense.",
        values: {
          home: money(home),
          rooms: children.length,
          total: money(roomsTotal),
        },
        evidence: [
          { label: "Casa completa", value: money(home) },
          { label: "Suma de habitaciones", value: money(roomsTotal) },
        ],
        href: href.rates,
        cta: "Ajustar tarifas",
      });
  }

  // 12. Low season ahead with no plan.
  const lowSoon = Array.from({ length: 60 }, (_, i) => addDays(today, i)).filter(
    isLowSeason,
  ).length;
  if (lowSoon > 20 && (next90?.occupancy ?? 1) < niche.targetOccupancy)
    recs.push({
      id: "low-season",
      area: "demanda",
      priority: 2,
      confidence: "baja",
      title: "Se acerca temporada baja",
      why: "{days} de los próximos 60 días son temporada baja en destinos de playa y tu ritmo a 90 días va en {occ}.",
      action:
        "Crea un paquete de estancia larga (7 noches por el precio de 6) y una oferta para nómadas digitales o grupos de escritura.",
      values: { days: lowSoon, occ: pct(next90?.occupancy ?? null) },
      evidence: [{ label: "Días de temporada baja", value: String(lowSoon) }],
      href: href.rates,
      cta: "Ajustar tarifas",
    });

  // 13. Competitor data missing or stale.
  if (!market.observations.length)
    recs.push({
      id: "no-market",
      area: "datos",
      priority: 3,
      confidence: "alta",
      title: "Dale datos de tu competencia al agente",
      why: "Sin observaciones de mercado el agente solo compara contra tu historial y el nicho.",
      action:
        "Una vez al mes anota precio y ocupación de 3–5 alojamientos parecidos de tu zona (Airbnb/Booking) e impórtalos como CSV aquí abajo.",
      values: {},
      evidence: [],
      href: href.market,
      cta: "Importar datos",
    });

  const order = { 1: 0, 2: 1, 3: 2 };
  recs.sort((a, b) => order[a.priority] - order[b.priority]);
  return {
    niche,
    steps,
    metrics: [
      { label: "Ocupación últimos 90 días", value: pct(past?.occupancy ?? null) },
      { label: "Reservado próximos 30 días", value: pct(next30?.occupancy ?? null) },
      { label: "Tarifa media (ADR)", value: past?.adrMinor ? money(past.adrMinor) : "—" },
      {
        label: "Duración media",
        value: past?.averageStayNights ? past.averageStayNights.toFixed(1) : "—",
        hint: "noches",
      },
      { label: "Reservas directas", value: pct(direct) },
      {
        label: "Mercado (ADR)",
        value: market.adrMinor ? money(market.adrMinor) : "—",
      },
    ],
    recommendations: recs,
    generatedAt: new Date().toISOString(),
  };
}

/** English versions of every agent text. */
export const advisorEnglish: Record<string, string> = {
  "Casa o villa vacacional": "Vacation home or villa",
  "Familias y grupos que buscan privacidad y estancias de varias noches":
    "Families and groups looking for privacy and multi-night stays",
  "Hotel boutique / casa de huéspedes": "Boutique hotel / guesthouse",
  "Parejas y viajeros que buscan experiencia y trato cercano":
    "Couples and travelers looking for experience and a personal touch",
  Hostal: "Hostel",
  "Viajeros jóvenes y mochileros sensibles al precio":
    "Young, price-sensitive travelers and backpackers",
  "Investigando el nicho": "Researching the niche",
  "{niche}: {guests}. Ocupación sana de referencia: {target}.":
    "{niche}: {guests}. Healthy reference occupancy: {target}.",
  "Revisando la competencia": "Reviewing the competition",
  "{count} observaciones de mercado comparables: ADR {adr}, ocupación {occ}.":
    "{count} comparable market observations: ADR {adr}, occupancy {occ}.",
  "Sin datos de competencia importados; se usan referencias del nicho y temporada.":
    "No competitor data imported; using niche and season references.",
  "Estudiando tu historial": "Studying your history",
  "{bookings} reservas en los últimos 90 días, ocupación {occ}, tarifa media {adr}.":
    "{bookings} reservations in the last 90 days, occupancy {occ}, average rate {adr}.",
  "Midiendo el ritmo de reservas": "Measuring booking pace",
  "Próximos 30 días: {n30} reservado · próximos 90 días: {n90}.":
    "Next 30 days: {n30} booked · next 90 days: {n90}.",
  "El próximo mes está flojo": "Next month is slow",
  "Solo {occ} de las noches de los próximos 30 días están vendidas y hay {empty} días con espacio libre.":
    "Only {occ} of the next 30 days' nights are sold and {empty} days have free space.",
  "Baja la estancia mínima a 1 noche entre semana, aplica 10–15 % de descuento a las noches libres de los próximos 14 días y comparte una oferta directa con huéspedes anteriores.":
    "Lower the minimum stay to 1 night on weekdays, take 10–15% off free nights in the next 14 days and share a direct offer with past guests.",
  "Alta demanda: estás vendiendo rápido": "High demand: you're selling fast",
  "Ya tienes {occ} del próximo mes vendido. Las noches que quedan valen más.":
    "You've already sold {occ} of next month. The remaining nights are worth more.",
  "Sube 10–15 % las noches libres de los próximos 30 días y pide estancia mínima de 2 noches para no dejar huecos.":
    "Raise free nights in the next 30 days by 10–15% and require a 2-night minimum to avoid gaps.",
  "Temporada alta con precio base": "Peak season at base price",
  "{count} noches de {periods} siguen con la tarifa base. En tu nicho estas fechas se venden antes y a mejor precio.":
    "{count} nights of {periods} are still at the base rate. In your niche these dates sell earlier and at better prices.",
  "Sube 20–30 % esas fechas en Tarifas y fija una estancia mínima de {minStay} noches.":
    "Raise those dates 20–30% in Rates and set a {minStay}-night minimum stay.",
  "Huecos cortos entre estancias": "Short gaps between stays",
  "Hay {count} huecos de 1–2 noches entre reservas en los próximos 60 días; {blocked} no se pueden vender por la estancia mínima.":
    "There are {count} 1–2 night gaps between reservations in the next 60 days; {blocked} can't be sold because of the minimum stay.",
  "Baja la estancia mínima solo en esas fechas y ofrécelas con 15 % de descuento como extensión a los huéspedes que llegan o salen.":
    "Lower the minimum stay only on those dates and offer them at 15% off as an extension to arriving or departing guests.",
  "Los fines de semana se llenan, entre semana no": "Weekends fill up, weekdays don't",
  "Ocupación de viernes y sábado {weekend} contra {weekday} de domingo a jueves.":
    "Friday and Saturday occupancy {weekend} versus {weekday} Sunday to Thursday.",
  "Precio diferenciado: +10 % viernes y sábado, −10 % de domingo a jueves, y un paquete de 3 noches entre semana (por ejemplo con comida o tour).":
    "Differentiated pricing: +10% Friday and Saturday, −10% Sunday to Thursday, and a 3-night weekday package (for example with food or a tour).",
  "Cobras menos que tu competencia": "You charge less than your competitors",
  "Tu tarifa media es {own} y la del mercado {market} ({ratio} del mercado) con igual o mejor ocupación.":
    "Your average rate is {own} and the market's is {market} ({ratio} of market) with equal or better occupancy.",
  "Sube tus tarifas 5–10 % y revisa la ocupación en dos semanas.":
    "Raise your rates 5–10% and review occupancy in two weeks.",
  "Precio alto para tu ocupación": "High price for your occupancy",
  "Tu tarifa media ({own}) está {ratio} del mercado, pero tu ocupación ({occ}) va por debajo de la competencia ({marketOcc}).":
    "Your average rate ({own}) is {ratio} of market, but your occupancy ({occ}) trails the competition ({marketOcc}).",
  "Baja 5–8 % las noches libres de los próximos 45 días o añade valor (desayuno, traslado) sin bajar precio.":
    "Lower free nights in the next 45 days by 5–8% or add value (breakfast, transfer) without cutting price.",
  "Pocas reservas directas": "Few direct bookings",
  "Solo {share} de tus reservas recientes son directas; en tu nicho lo sano es {goal} o más. Cada reserva directa ahorra la comisión de la OTA.":
    "Only {share} of your recent reservations are direct; in your niche {goal} or more is healthy. Every direct booking saves the OTA commission.",
  "Envía a tus huéspedes anteriores una plantilla con un código de regreso y destaca en la web los extras que las OTAs no ofrecen.":
    "Send past guests a template with a return code and highlight on the website the extras OTAs don't offer.",
  "Tus huéspedes anteriores son tu mejor canal": "Past guests are your best channel",
  "Tienes {count} huéspedes que ya se hospedaron. Volver a contactarlos cuesta menos que atraer nuevos.":
    "You have {count} guests who have stayed before. Reaching them again costs less than attracting new ones.",
  "Antes de cada temporada alta, envía una invitación con prioridad de fechas y 5–10 % de descuento directo.":
    "Before each peak season, send an invitation with priority dates and a 5–10% direct discount.",
  "Demasiadas cancelaciones": "Too many cancellations",
  "{rate} de las llegadas recientes se cancelaron (referencia del nicho: menos de {max}).":
    "{rate} of recent arrivals were cancelled (niche reference: under {max}).",
  "Pide un anticipo no reembolsable en temporada alta y ofrece una tarifa flexible algo más cara para quien quiera cancelar.":
    "Ask for a non-refundable deposit in peak season and offer a slightly pricier flexible rate for guests who want to cancel.",
  "Tus huéspedes reservan a última hora": "Your guests book last minute",
  "Reservan en promedio {days} días antes de llegar.":
    "They book {days} days before arrival on average.",
  "No bajes precios con mucha anticipación: espera a 7–10 días antes para aplicar descuentos a noches libres y mantén el calendario abierto al menos 12 meses.":
    "Don't cut prices far in advance: wait until 7–10 days before to discount free nights and keep the calendar open at least 12 months.",
  "Te reservan con mucha anticipación": "Guests book well in advance",
  "Reservan en promedio {days} días antes. Hay espacio para subir las fechas cercanas.":
    "They book {days} days ahead on average. There's room to raise near-term dates.",
  "Ofrece un descuento por reserva anticipada (60+ días) y sube 5–10 % las noches que quedan libres a menos de 30 días.":
    "Offer an early-bird discount (60+ days) and raise nights still free within 30 days by 5–10%.",
  "{unit} se vende menos que las demás": "{unit} sells less than the others",
  "{unit} tiene {occ} de ocupación contra {avg} del resto de la propiedad.":
    "{unit} has {occ} occupancy versus {avg} for the rest of the property.",
  "Revisa sus fotos y descripción en «Alojamientos y página web» y prueba un precio 8–10 % menor durante un mes.":
    "Review its photos and description in «Accommodations & website» and try an 8–10% lower price for a month.",
  "La casa completa vale menos que sus habitaciones": "The entire house is worth less than its rooms",
  "La casa completa cuesta {home} por noche, pero sus {rooms} habitaciones juntas suman {total}. Venderla bloquea todas las habitaciones.":
    "The entire house costs {home} per night, but its {rooms} rooms together add up to {total}. Selling it blocks every room.",
  "Pon la casa completa al menos al 90 % de la suma de habitaciones y pide 2–3 noches mínimas para que compense.":
    "Price the entire house at 90% or more of the rooms' total and require 2–3 minimum nights so it pays off.",
  "Se acerca temporada baja": "Low season is coming",
  "{days} de los próximos 60 días son temporada baja en destinos de playa y tu ritmo a 90 días va en {occ}.":
    "{days} of the next 60 days are low season for beach destinations and your 90-day pace is {occ}.",
  "Crea un paquete de estancia larga (7 noches por el precio de 6) y una oferta para nómadas digitales o grupos de escritura.":
    "Create a long-stay package (7 nights for the price of 6) and an offer for digital nomads or writing groups.",
  "Dale datos de tu competencia al agente": "Give the agent your competitors' data",
  "Sin observaciones de mercado el agente solo compara contra tu historial y el nicho.":
    "Without market observations the agent only compares against your history and the niche.",
  "Una vez al mes anota precio y ocupación de 3–5 alojamientos parecidos de tu zona (Airbnb/Booking) e impórtalos como CSV aquí abajo.":
    "Once a month, note price and occupancy for 3–5 similar properties in your area (Airbnb/Booking) and import them as CSV below.",
  "Ocupación últimos 90 días": "Occupancy last 90 days",
  "Reservado próximos 30 días": "Booked next 30 days",
  "Tarifa media (ADR)": "Average rate (ADR)",
  "Reservas directas": "Direct bookings",
  "Mercado (ADR)": "Market (ADR)",
  "Ocupación 30 días": "30-day occupancy",
  "Días con espacio": "Days with space",
  "Primera fecha": "First date",
  "Noches sin precio propio": "Nights without own price",
  Huecos: "Gaps",
  "Bloqueados por estancia mínima": "Blocked by minimum stay",
  "Fin de semana": "Weekend",
  "Entre semana": "Weekdays",
  "Tu ADR": "Your ADR",
  "ADR del mercado": "Market ADR",
  "Tu ocupación": "Your occupancy",
  "Ocupación del mercado": "Market occupancy",
  "Directas (180 días)": "Direct (180 days)",
  "Reservas analizadas": "Reservations analyzed",
  "Huéspedes con estancias": "Guests with stays",
  "Ocupación de la unidad": "Unit occupancy",
  "Promedio de la propiedad": "Property average",
  "Suma de habitaciones": "Rooms total",
  "Días de temporada baja": "Low-season days",
  "Ajustar tarifas": "Adjust rates",
  "Abrir Tarifas": "Open Rates",
  "Ver calendario": "View calendar",
  "Crear plantilla": "Create template",
  "Ver huéspedes": "View guests",
  "Revisar planes": "Review plans",
  "Abrir inventario": "Open inventory",
  "Importar datos": "Import data",
  "Año Nuevo y Reyes": "New Year and Epiphany",
  "Semana Santa y Pascua": "Holy Week and Easter",
  "Vacaciones de verano": "Summer holidays",
  "Navidad y fin de año": "Christmas and New Year",
  // Agent UI
  "AGENTE DE MERCADO": "MARKET AGENT",
  "Tu analista de reservas": "Your booking analyst",
  "Investiga tu nicho y tu competencia, estudia el historial de CALA y te dice qué hacer para vender más. Usa reglas y un banco de conocimiento, no inventa datos.":
    "Researches your niche and competition, studies CALA's history and tells you what to do to sell more. It uses rules and a knowledge bank; it never makes up data.",
  "Analizar ahora": "Analyze now",
  "Volver a analizar": "Analyze again",
  "Analizando…": "Analyzing…",
  "Recomendaciones": "Recommendations",
  "Actúa ahora": "Act now",
  "Esta semana": "This week",
  "Cuando puedas": "When you can",
  "Confianza {level}": "{level} confidence",
  alta: "high",
  media: "medium",
  baja: "low",
  "Por qué": "Why",
  "Qué hacer": "What to do",
  "Todo en orden: no hay acciones urgentes con los datos actuales.":
    "All good: no urgent actions with the current data.",
  "Análisis de {time}": "Analysis from {time}",
  "Nicho: {niche}": "Niche: {niche}",
  "Palancas que suelen funcionar en tu nicho": "Levers that usually work in your niche",
  "Estancia mínima de 2–3 noches en fines de semana y temporada alta":
    "2–3 night minimum stay on weekends and in peak season",
  "Descuento semanal (7+ noches) para competir con otras casas":
    "Weekly discount (7+ nights) to compete with other homes",
  "Fotos de áreas comunes y capacidad clara": "Photos of common areas and clear capacity",
  "Venta directa con experiencias y comida como valor agregado":
    "Direct sales with experiences and food as added value",
  "Precio por día de la semana: fines de semana más altos":
    "Price by day of week: higher on weekends",
  "Huéspedes recurrentes y reseñas recientes": "Returning guests and recent reviews",
  "Precio por cama dinámico": "Dynamic per-bed pricing",
  "Eventos y comunidad": "Events and community",
  "Última hora": "Last minute",
  "Las recomendaciones no cambian tarifas por sí solas: tú decides y aplicas desde CALA.":
    "Recommendations never change rates on their own: you decide and apply them in CALA.",
};

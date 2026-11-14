"use client";
import React, { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { addDays, format } from "date-fns";
import type { Locale } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, BedDouble, CalendarDays, Check, ChevronDown, CornerDownRight, Home, Minus, Moon, Plus, Search, Sparkles, Users } from "lucide-react";
import { lodgingPrice, lodgingText } from "@/lib/lodgings";
import { customSelection, type PlannedRoom, type StayOption } from "@/lib/stayPlanner";
import type { StaySuggestion } from "@/lib/staySuggestions";
import { dayStatus, localDate, type AvailabilityOverviewData, type BookingLodging, type Device } from "./AvailabilityOverview";

export type StaySearchResult = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  currency: string;
  lodgings: Array<{ lodgingId: string; available: true; totalMinor: number } | { lodgingId: string; available: false; code: string }>;
  options: StayOption[];
  /** Only when no option fits: the closest stays that do, already priced by CALA. */
  suggestions?: StaySuggestion[];
  /** Only when no option fits: how many people could still stay on the requested dates. */
  sameDatesCapacity?: number | null;
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function Stepper({ label, hint, value, min, max, onChange, icon }: { label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3.5 md:py-4 border-b border-[#EFE9E1] last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-9 h-9 rounded-full bg-[#F4F0EA] text-[#9B7E67] flex items-center justify-center shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="font-semibold text-[#23211F] text-base">{label}</p>
          {hint && <p className="text-xs text-gray-500">{hint}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button type="button" aria-label={`${label} −`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="w-9 h-9 rounded-full border border-[#D9D1C6] flex items-center justify-center text-[#23211F] disabled:opacity-30 hover:border-[#9B7E67] transition-colors"><Minus size={16} /></button>
        <span className="w-6 text-center font-bold text-lg text-[#23211F] tabular-nums" aria-live="polite">{value}</span>
        <button type="button" aria-label={`${label} +`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="w-9 h-9 rounded-full bg-[#23211F] text-white flex items-center justify-center disabled:opacity-30 hover:bg-[#9B7E67] transition-colors"><Plus size={16} /></button>
      </div>
    </div>
  );
}

/** Step 1 of the multi-room flow: arrival, nights and group size. */
export function StaySearchForm({
  catalog, overview, isEn, locale, device, arrival, nights, adults, minors: children, onArrival, onNights, onAdults, onChildren, onSearch,
}: {
  catalog: BookingLodging[]; overview: AvailabilityOverviewData | null; isEn: boolean; locale: Locale; device: Device;
  arrival?: Date; nights: number; adults: number; minors: number;
  onArrival: (d: Date | undefined) => void; onNights: (n: number) => void; onAdults: (n: number) => void; onChildren: (n: number) => void; onSearch: () => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(device !== "mobile" || !arrival);
  const totalCapacity = useMemo(() => {
    const rooms = catalog.filter((l) => l.kind === "room").reduce((s, l) => s + l.capacity, 0);
    const house = catalog.find((l) => l.kind === "whole_home")?.capacity ?? 0;
    return Math.max(rooms, house, 1);
  }, [catalog]);
  const minStay = catalog.length ? Math.min(...catalog.map((l) => l.minStay)) : 1;
  const maxStay = catalog.length ? Math.max(...catalog.map((l) => l.maxStay)) : 30;
  const lead = catalog.length ? Math.min(...catalog.map((l) => l.leadTimeDays)) : 0;
  const today = overview ? localDate(overview.today) : new Date(new Date().setHours(0, 0, 0, 0));
  const firstArrival = addDays(today, lead);
  // An arrival is pointless when no lodging is free that night.
  const noneFree = (d: Date) => !!overview && catalog.length > 0 && catalog.every((l) => dayStatus(overview, l.id, iso(d)) !== "free");
  const departure = arrival ? addDays(arrival, nights) : undefined;
  const guests = adults + children;
  const ready = Boolean(arrival) && nights >= 1 && adults >= 1;

  const calendar = (
    <DayPicker
      mode="single"
      selected={arrival}
      onSelect={(d) => { onArrival(d); if (d && device === "mobile") setCalendarOpen(false); }}
      disabled={[{ before: firstArrival }, noneFree]}
      modifiers={departure && arrival ? { stay: { from: addDays(arrival, 1), to: departure } } : undefined}
      modifiersClassNames={{ stay: "rdp-day_stay" }}
      locale={locale}
      startMonth={today}
      endMonth={new Date(today.getFullYear() + 2, 11)}
      className="premium-calendar !m-0"
    />
  );

  return (
    <section className="flex flex-col gap-5 md:gap-6 pb-6" aria-label={isEn ? "Search availability" : "Buscar disponibilidad"}>
      <header>
        <p className="text-[10px] md:text-[11px] tracking-[0.3em] uppercase text-[#9B7E67] font-bold mb-2">{isEn ? "Your stay" : "Tu estancia"}</p>
        <h3 className="text-3xl font-serif text-[#23211F]">{isEn ? "When and how many?" : "¿Cuándo y cuántos son?"}</h3>
        <p className="text-gray-500 mt-2 text-sm md:text-base">
          {isEn ? "We will look up every room in real time and recommend one, two or more rooms — or the whole house — for your group." : "Buscaremos en tiempo real todas las habitaciones y te recomendaremos una, dos o más habitaciones —o la casa completa— para tu grupo."}
        </p>
      </header>

      <div className={`grid gap-4 md:gap-5 ${device === "desktop" ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start" : "grid-cols-1"}`}>
        {/* Arrival */}
        <div className="bg-white rounded-2xl md:rounded-3xl border border-[#E8E1D8] shadow-sm p-4 md:p-5">
          <button type="button" onClick={() => setCalendarOpen((o) => !o)} aria-expanded={calendarOpen} className="w-full flex items-center justify-between gap-3 text-left">
            <span className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-[#F4F0EA] text-[#9B7E67] flex items-center justify-center"><CalendarDays size={18} /></span>
              <span>
                <span className="block text-[10px] uppercase tracking-widest font-bold text-gray-400">{isEn ? "Arrival" : "Llegada"}</span>
                <span className="block font-semibold text-[#23211F] capitalize">{arrival ? format(arrival, "EEEE d MMM yyyy", { locale }) : isEn ? "Choose a date" : "Elige una fecha"}</span>
              </span>
            </span>
            {device === "mobile" && <ChevronDown size={18} className={`transition-transform ${calendarOpen ? "rotate-180" : ""}`} />}
          </button>
          <AnimatePresence initial={false}>
            {calendarOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="pt-4 flex justify-center">{calendar}</div>
                <p className="text-[11px] text-gray-500 text-center mt-2">{isEn ? "Greyed-out days have no free room." : "Los días en gris no tienen ninguna habitación libre."}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nights + guests */}
        <div className="bg-white rounded-2xl md:rounded-3xl border border-[#E8E1D8] shadow-sm px-4 md:px-5 py-1">
          <Stepper label={isEn ? "Nights" : "Noches"} hint={departure ? `${isEn ? "Check-out" : "Salida"}: ${format(departure, "EEE d MMM", { locale })}` : isEn ? `Minimum ${minStay}` : `Mínimo ${minStay}`} value={nights} min={Math.max(1, minStay)} max={maxStay} onChange={onNights} icon={<Moon size={17} />} />
          <Stepper label={isEn ? "Adults" : "Adultos"} hint={isEn ? "13 years and older" : "13 años o más"} value={adults} min={1} max={totalCapacity} onChange={(v) => { onAdults(v); if (v + children > totalCapacity) onChildren(Math.max(0, totalCapacity - v)); }} icon={<Users size={17} />} />
          <Stepper label={isEn ? "Children" : "Menores"} hint={isEn ? "Up to 12 years" : "Hasta 12 años"} value={children} min={0} max={Math.max(0, totalCapacity - adults)} onChange={onChildren} icon={<Users size={15} />} />
          <p className="text-xs text-gray-500 py-3">
            {isEn ? `${guests} guest${guests === 1 ? "" : "s"} · the property sleeps up to ${totalCapacity}` : `${guests} ${guests === 1 ? "persona" : "personas"} · la casa recibe hasta ${totalCapacity}`}
          </p>
        </div>
      </div>

      <motion.button
        type="button"
        onClick={onSearch}
        disabled={!ready}
        whileHover={ready ? { scale: 1.01, y: -1 } : {}}
        whileTap={ready ? { scale: 0.98 } : {}}
        className="w-full md:w-auto md:self-end md:px-12 py-4 rounded-full bg-[#23211F] text-[#F9F7F4] font-bold uppercase tracking-widest text-sm md:text-base flex items-center justify-center gap-3 shadow-xl disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none transition-colors"
      >
        <Search size={18} /> {isEn ? "Find rooms" : "Buscar habitaciones"}
      </motion.button>
      {!arrival && <p className="text-amber-600 text-[11px] font-bold text-center md:text-right -mt-3">{isEn ? "Choose your arrival date" : "Elige tu fecha de llegada"}</p>}
    </section>
  );
}

const reasonText = (code: string, isEn: boolean) =>
  ({
    LODGING_RULES: isEn ? "Doesn't meet its minimum stay or advance notice" : "No cumple su estancia mínima o anticipación",
    RATE_RESTRICTION: isEn ? "Closed or restricted on some night" : "Cerrada o con restricción alguna noche",
    DEPARTURE_CLOSED: isEn ? "No check-outs on that date" : "No admite salidas ese día",
    LODGING_SALES_CLOSED: isEn ? "Not on sale for those dates" : "Sin venta en esas fechas",
  })[code] ?? (isEn ? "Booked on those dates" : "Ocupada en esas fechas");

/** What changed from the stay the guest asked for, in a few words. */
function suggestionLabel(s: StaySuggestion, isEn: boolean) {
  const days = Math.abs(s.shiftDays);
  const move = s.shiftDays === 0 ? (isEn ? "Same arrival" : "Misma llegada")
    : isEn ? `${days} ${days === 1 ? "day" : "days"} ${s.shiftDays > 0 ? "later" : "earlier"}`
    : `${days} ${days === 1 ? "día" : "días"} ${s.shiftDays > 0 ? "después" : "antes"}`;
  const delta = Math.abs(s.nightsDelta);
  const length = s.nightsDelta === 0 ? (isEn ? "same nights" : "mismas noches")
    : isEn ? `${delta} ${delta === 1 ? "night" : "nights"} ${s.nightsDelta > 0 ? "more" : "fewer"}`
    : `${delta} ${delta === 1 ? "noche" : "noches"} ${s.nightsDelta > 0 ? "más" : "menos"}`;
  return `${move} · ${length}`;
}

const people = (r: { adults: number; children: number }, isEn: boolean) =>
  `${r.adults} ${isEn ? (r.adults === 1 ? "adult" : "adults") : r.adults === 1 ? "adulto" : "adultos"}${r.children ? ` · ${r.children} ${isEn ? (r.children === 1 ? "child" : "children") : r.children === 1 ? "menor" : "menores"}` : ""}`;

/** Step 2: recommended combinations, or a hand-picked set of rooms. */
export function StayResults({
  catalog, result, loading, error, isEn, locale, device, onChoose, onEdit, onSuggestion,
}: {
  catalog: BookingLodging[]; result: StaySearchResult | null; loading: boolean; error: string; isEn: boolean; locale: Locale; device: Device;
  onChoose: (rooms: PlannedRoom[]) => void; onEdit: () => void; onSuggestion: (suggestion: StaySuggestion) => void;
}) {
  const lang = isEn ? "en" : "es";
  const [manual, setManual] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const byId = (id: string) => catalog.find((l) => l.id === id);
  const money = (minor: number) => lodgingPrice(minor, result?.currency ?? "MXN", lang);
  const nights = result ? Math.round((Date.parse(result.checkOut) - Date.parse(result.checkIn)) / 86400000) : 0;

  const available = (result?.lodgings ?? []).filter((l): l is { lodgingId: string; available: true; totalMinor: number } => l.available);
  const custom = useMemo(() => {
    if (!result) return null;
    const chosen = picked.flatMap((id) => {
      const l = byId(id), q = available.find((a) => a.lodgingId === id);
      return l && q ? [{ id, kind: l.kind, capacity: l.capacity, totalMinor: q.totalMinor }] : [];
    });
    return customSelection(chosen, result.adults, result.children);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, result]);

  const summary = result && (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
      <span className="capitalize">{format(localDate(result.checkIn), "EEE d MMM", { locale })} → {format(localDate(result.checkOut), "EEE d MMM", { locale })}</span>
      <span>· {nights} {isEn ? (nights === 1 ? "night" : "nights") : nights === 1 ? "noche" : "noches"}</span>
      <span>· {people(result, isEn)}</span>
      <button type="button" onClick={onEdit} className="underline text-[#9B7E67] font-semibold">{isEn ? "Change" : "Modificar"}</button>
    </div>
  );

  const roomLine = (r: PlannedRoom) => {
    const l = byId(r.lodgingId);
    if (!l) return null;
    return (
      <li key={r.lodgingId} className="flex items-center gap-3">
        {l.images[0] ? <img src={l.images[0]} alt="" className={`${device === "mobile" ? "w-12 h-12" : "w-14 h-14"} rounded-xl object-cover shrink-0`} /> : (
          <span className={`${device === "mobile" ? "w-12 h-12" : "w-14 h-14"} rounded-xl bg-[#EAE5DD] flex items-center justify-center shrink-0`}>{l.kind === "whole_home" ? <Home size={18} className="text-[#9B7E67]" /> : <BedDouble size={18} className="text-[#9B7E67]" />}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#23211F] leading-tight truncate">{lodgingText(l.name, lang)}</p>
          <p className="text-xs text-gray-500">{people(r, isEn)} · {isEn ? "sleeps" : "capacidad"} {l.capacity}</p>
        </div>
        <span className="text-sm font-semibold text-[#9B7E67] shrink-0">{money(r.totalMinor)}</span>
      </li>
    );
  };

  return (
    <section className="flex flex-col gap-5 pb-6" aria-label={isEn ? "Room options" : "Opciones de habitaciones"}>
      <header>
        {result && !loading && !result.options.length ? (
          <>
            <p className="text-[10px] md:text-[11px] tracking-[0.3em] uppercase text-[#9B7E67] font-bold mb-2">{isEn ? "Other dates for you" : "Otras fechas para ti"}</p>
            <h3 className="text-3xl font-serif text-[#23211F] mb-2">{isEn ? "Let's find you a spot" : "Busquemos un lugar para ti"}</h3>
          </>
        ) : (
          <>
            <p className="text-[10px] md:text-[11px] tracking-[0.3em] uppercase text-[#9B7E67] font-bold mb-2">{isEn ? "Recommended for you" : "Recomendado para ti"}</p>
            <h3 className="text-3xl font-serif text-[#23211F] mb-2">{isEn ? "Where your group fits" : "Así se acomoda tu grupo"}</h3>
          </>
        )}
        {summary}
      </header>

      {loading && (
        <div role="status" className="space-y-3" aria-label={isEn ? "Searching rooms" : "Buscando habitaciones"}>
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-32 rounded-3xl bg-white border border-[#EFE9E1] animate-pulse" />)}
        </div>
      )}
      {error && !loading && <p role="alert" className="text-red-700 bg-red-50 rounded-2xl p-4 text-sm">{error}</p>}

      {result && !loading && !manual && (
        result.options.length ? (
          <ul className="space-y-4">
            {result.options.map((o, index) => (
              <motion.li key={o.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
                className={`bg-white rounded-3xl border p-4 md:p-5 shadow-sm ${o.recommended ? "border-[#9B7E67] ring-1 ring-[#9B7E67]/30" : "border-[#E8E1D8]"}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    {o.recommended && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#9B7E67] mb-1"><Sparkles size={12} />{isEn ? "Best fit" : "Mejor opción"}</span>}
                    <h4 className="font-serif text-xl text-[#23211F]">
                      {o.kind === "whole_home" ? (isEn ? "The whole house" : "La casa completa") : o.rooms.length === 1 ? (isEn ? "1 room" : "1 habitación") : isEn ? `${o.rooms.length} rooms` : `${o.rooms.length} habitaciones`}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {isEn ? `Sleeps ${o.capacity}` : `Capacidad ${o.capacity}`}{o.spareBeds > 0 ? ` · ${o.spareBeds} ${isEn ? (o.spareBeds === 1 ? "spare bed" : "spare beds") : o.spareBeds === 1 ? "lugar libre" : "lugares libres"}` : ` · ${isEn ? "perfect fit" : "a la medida"}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-serif text-2xl text-[#23211F] leading-none">{money(o.totalMinor)}</p>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">{nights} {isEn ? "nights · taxes incl." : "noches · imp. incl."}</p>
                  </div>
                </div>
                <ul className="space-y-2.5 py-3 border-y border-[#F4F0EA]">{o.rooms.map(roomLine)}</ul>
                <button type="button" onClick={() => onChoose(o.rooms)} className={`mt-4 w-full py-3 rounded-full font-bold uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-2 transition-colors ${o.recommended ? "bg-[#23211F] text-[#F9F7F4] hover:bg-[#3a3632]" : "border border-[#23211F] text-[#23211F] hover:bg-[#23211F] hover:text-[#F9F7F4]"}`}>
                  {isEn ? "Choose this option" : "Elegir esta opción"} <ArrowRight size={16} />
                </button>
              </motion.li>
            ))}
          </ul>
        ) : (
          <div className="space-y-4">
            <div className="bg-[#FAF8F5] border border-[#D4A574] rounded-2xl p-5 text-[#7A5F49] space-y-2">
              <p className="font-serif text-xl">{isEn ? "Those dates are full for your group" : "Esas fechas ya no tienen lugar para tu grupo"}</p>
              <p className="text-sm">
                {result.sameDatesCapacity
                  ? (isEn
                    ? `On those dates there is room for up to ${result.sameDatesCapacity} ${result.sameDatesCapacity === 1 ? "guest" : "guests"}, not for ${result.adults + result.children}.`
                    : `En esas fechas queda lugar para hasta ${result.sameDatesCapacity} ${result.sameDatesCapacity === 1 ? "persona" : "personas"}, no para ${result.adults + result.children}.`)
                  : (isEn ? "Every room is taken or closed on those dates." : "Todas las habitaciones están ocupadas o cerradas en esas fechas.")}
                {result.suggestions?.length ? (isEn ? " We looked for the closest dates that do fit your group:" : " Buscamos las fechas más cercanas donde sí cabe tu grupo:") : ""}
              </p>
            </div>

            {result.suggestions?.length ? (
              <ul className="space-y-3" aria-label={isEn ? "Suggested dates" : "Fechas sugeridas"}>
                {result.suggestions.map((s, index) => {
                  const o = s.option;
                  const names = o.rooms.map((r) => { const l = byId(r.lodgingId); return l ? lodgingText(l.name, lang) : ""; }).filter(Boolean);
                  return (
                    <motion.li key={s.checkIn + s.nights} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
                      className={`bg-white rounded-3xl border p-4 md:p-5 shadow-sm ${index === 0 ? "border-[#9B7E67] ring-1 ring-[#9B7E67]/30" : "border-[#E8E1D8]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#9B7E67] mb-1">
                            {index === 0 && <Sparkles size={12} />}{suggestionLabel(s, isEn)}
                          </span>
                          <h4 className="font-serif text-xl text-[#23211F] capitalize">
                            {format(localDate(s.checkIn), "EEE d MMM", { locale })} → {format(localDate(s.checkOut), "EEE d MMM", { locale })}
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {s.nights} {isEn ? (s.nights === 1 ? "night" : "nights") : s.nights === 1 ? "noche" : "noches"} · {people(result, isEn)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-serif text-2xl text-[#23211F] leading-none">{money(o.totalMinor)}</p>
                          <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">{isEn ? "taxes incl." : "imp. incl."}</p>
                        </div>
                      </div>
                      <p className="flex items-start gap-2 text-sm text-[#524D48] mt-3 pt-3 border-t border-[#F4F0EA]">
                        {o.kind === "whole_home" ? <Home size={16} className="text-[#9B7E67] shrink-0 mt-0.5" /> : <BedDouble size={16} className="text-[#9B7E67] shrink-0 mt-0.5" />}
                        <span>
                          {o.kind === "whole_home" ? (isEn ? "The whole house" : "La casa completa") : o.rooms.length === 1 ? (isEn ? "1 room" : "1 habitación") : isEn ? `${o.rooms.length} rooms` : `${o.rooms.length} habitaciones`}
                          {o.kind !== "whole_home" && names.length ? `: ${names.join(" + ")}` : ""}
                        </span>
                      </p>
                      <button type="button" onClick={() => onSuggestion(s)} className={`mt-4 w-full py-3 rounded-full font-bold uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-2 transition-colors ${index === 0 ? "bg-[#23211F] text-[#F9F7F4] hover:bg-[#9B7E67]" : "border border-[#23211F] text-[#23211F] hover:bg-[#23211F] hover:text-[#F9F7F4]"}`}>
                        {isEn ? "See these dates" : "Ver estas fechas"} <ArrowRight size={16} />
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-600 px-1">
                {isEn ? "We found no nearby dates for your group. Try other dates, fewer nights or a smaller group." : "No encontramos fechas cercanas para tu grupo. Prueba otras fechas, menos noches o un grupo más pequeño."}
              </p>
            )}
            <button type="button" onClick={onEdit} className="underline font-semibold text-sm text-[#7A5F49] px-1">{isEn ? "Choose other dates myself" : "Elegir yo otras fechas"}</button>
          </div>
        )
      )}

      {result && !loading && (
        <div className="bg-white rounded-3xl border border-[#E8E1D8] shadow-sm">
          <button type="button" onClick={() => setManual((m) => !m)} aria-expanded={manual} className="w-full flex items-center justify-between gap-3 p-4 md:p-5 text-left">
            <span>
              <span className="block font-semibold text-[#23211F]">{manual ? (isEn ? "Back to recommendations" : "Volver a las recomendaciones") : isEn ? "I'd rather pick the rooms myself" : "Prefiero elegir yo las habitaciones"}</span>
              <span className="block text-xs text-gray-500">{isEn ? "Select one or more rooms; we'll spread your group across them." : "Selecciona una o varias; repartimos a tu grupo entre ellas."}</span>
            </span>
            <ChevronDown size={18} className={`shrink-0 transition-transform ${manual ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {manual && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <ul className={`grid gap-2 px-4 md:px-5 ${device === "mobile" ? "grid-cols-1" : "grid-cols-2"}`}>
                  {result.lodgings.map((q) => {
                    const l = byId(q.lodgingId);
                    if (!l) return null;
                    const on = picked.includes(l.id);
                    return (
                      <li key={l.id} className={l.kind === "whole_home" ? "col-span-full" : ""}>
                        <button type="button" disabled={!q.available} aria-pressed={on}
                          onClick={() => setPicked((p) => (on ? p.filter((x) => x !== l.id) : l.kind === "whole_home" ? [l.id] : [...p.filter((x) => byId(x)?.kind !== "whole_home"), l.id]))}
                          className={`w-full h-full text-left flex items-start gap-3 p-3 rounded-2xl border transition-colors ${l.kind === "whole_home" ? "bg-[#F7F2EC] " : ""}${!q.available ? "opacity-50 cursor-not-allowed border-[#EFE9E1]" : on ? "border-[#9B7E67] bg-[#FAF6F1]" : "border-[#E8E1D8] hover:border-[#9B7E67]"}`}>
                          <span className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? "bg-[#23211F] border-[#23211F] text-white" : "border-[#D9D1C6]"}`}>{on && <Check size={13} strokeWidth={3} />}</span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1 font-semibold text-sm text-[#23211F] leading-tight">
                              {l.kind === "whole_home" ? <Home size={13} className="text-[#9B7E67] shrink-0" /> : <CornerDownRight size={13} className="text-[#C9B99A] shrink-0" />}
                              {lodgingText(l.name, lang)}
                            </span>
                            <span className="block text-xs text-gray-500">{isEn ? "Sleeps" : "Capacidad"} {l.capacity}{q.available ? ` · ${money(q.totalMinor)}` : ""}</span>
                            {!q.available && <span className="block text-[11px] text-[#9B7E67]">{reasonText(q.code, isEn)}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="p-4 md:p-5 space-y-2">
                  {custom?.reason && custom.reason !== "empty" && (
                    <p className="text-amber-700 text-xs font-semibold">
                      {custom.reason === "capacity" ? (isEn ? `These rooms sleep fewer than ${result.adults + result.children} people.` : `Estas habitaciones no alcanzan para ${result.adults + result.children} personas.`)
                        : custom.reason === "adults" ? (isEn ? "Each room needs at least one adult." : "Cada habitación necesita al menos un adulto.")
                        : isEn ? "The whole house already includes every room." : "La casa completa ya incluye todas las habitaciones."}
                    </p>
                  )}
                  {custom?.option && <ul className="space-y-2 pb-2">{custom.option.rooms.map(roomLine)}</ul>}
                  <button type="button" disabled={!custom?.option} onClick={() => custom?.option && onChoose(custom.option.rooms)}
                    className="w-full py-3 rounded-full bg-[#23211F] text-[#F9F7F4] font-bold uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:text-gray-400">
                    {custom?.option ? `${isEn ? "Continue" : "Continuar"} · ${money(custom.option.totalMinor)}` : isEn ? "Select rooms" : "Selecciona habitaciones"} <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

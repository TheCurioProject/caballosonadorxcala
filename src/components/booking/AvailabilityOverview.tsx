"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { addDays, addMonths, format, getDaysInMonth, startOfMonth } from "date-fns";
import type { Locale } from "date-fns";
import { motion } from "framer-motion";
import { ArrowRight, BedDouble, CalendarDays, ChevronLeft, ChevronRight, CornerDownRight, Home, LayoutList, Users } from "lucide-react";
import { lodgingPrice, lodgingText, type Lodging } from "@/lib/lodgings";

export type BookingLodging = Lodging & { images: string[] };
export type Device = "mobile" | "tablet" | "desktop";
type Range = { from: string; to: string };
export type AvailabilityOverviewData = {
  today: string;
  lodgings: Array<{ id: string; booked: Range[]; blocked: Range[]; openThrough: string | null; leadTimeDays: number; minStay: number }>;
  foodBlockedRanges: Range[];
  tourBlockedRanges: Range[];
  tourBookedDates: string[];
};
export type DayStatus = "free" | "booked" | "blocked" | "past";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
export const localDate = (value: string) => {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Night status of a lodging (reservations win over closures). */
export function dayStatus(data: AvailabilityOverviewData, lodgingId: string, day: string): DayStatus {
  if (day < data.today) return "past";
  const row = data.lodgings.find((l) => l.id === lodgingId);
  if (!row) return "blocked";
  if (row.booked.some((r) => day >= r.from && day <= r.to)) return "booked";
  if (row.openThrough && day > row.openThrough) return "blocked";
  if (row.blocked.some((r) => day >= r.from && day <= r.to)) return "blocked";
  return "free";
}

/** Day column width when the month scrolls sideways (phones and tablets). */
const COLUMN: Record<Device, number> = { mobile: 40, tablet: 44, desktop: 0 };

/**
 * First screen of the booking modal: read-only availability of the house and
 * every room at a glance (no dates are chosen here). Every device shows the
 * whole month: it fits on desktop; on tablets and phones it scrolls sideways
 * with the lodging names pinned, like the CALA calendar.
 */
export function AvailabilityOverview({
  catalog,
  data,
  error,
  isEn,
  locale,
  device,
  onContinue,
}: {
  catalog: BookingLodging[];
  data: AvailabilityOverviewData | null;
  error: string;
  isEn: boolean;
  locale: Locale;
  device: Device;
  onContinue: () => void;
}) {
  const lang = isEn ? "en" : "es";
  const [tab, setTab] = useState<"calendar" | "rooms">("calendar");
  const today = data ? localDate(data.today) : new Date(new Date().setHours(0, 0, 0, 0));
  // Offset in months from the current one.
  const [page, setPage] = useState(0);
  const days = useMemo(() => {
    const start = startOfMonth(addMonths(today, page));
    return Array.from({ length: getDaysInMonth(start) }, (_, i) => addDays(start, i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, data?.today]);
  const title = format(days[0], "LLLL yyyy", { locale });
  const maxPage = 18;
  const rows = [...catalog].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "whole_home" ? -1 : 1));
  const freeRooms = data
    ? rows.filter((l) => dayStatus(data, l.id, data.today) === "free").length
    : 0;

  return (
    <section className="flex flex-col gap-5 md:gap-6 pb-6" aria-label={isEn ? "Availability at a glance" : "Disponibilidad de un vistazo"}>
      <header className="pr-12">
        <p className="text-[10px] md:text-[11px] tracking-[0.3em] uppercase text-[#9B7E67] font-bold mb-2">Casa Caballo Soñador</p>
        <h3 className="text-3xl md:text-4xl font-serif text-[#23211F] leading-tight">{isEn ? "Book your stay" : "Reserva tu estancia"}</h3>
        <p className="text-gray-500 mt-2 md:mt-3 leading-relaxed text-sm md:text-base max-w-2xl">
          {isEn
            ? "Check at a glance which rooms and dates are free. Next, tell us how many you are and for how long, and we will suggest the best rooms for your group."
            : "Consulta de un vistazo qué habitaciones y fechas están libres. Después dinos cuántos son y cuántas noches, y te recomendaremos las mejores habitaciones para tu grupo."}
        </p>
      </header>

      <div className="bg-white rounded-2xl md:rounded-3xl border border-[#E8E1D8] shadow-sm overflow-hidden">
        {/* Toolbar: tabs + period navigation */}
        <div className={`flex gap-3 p-3 md:p-4 border-b border-[#EFE9E1] ${device === "mobile" ? "flex-col" : "items-center justify-between"}`}>
          <div role="tablist" className="flex p-1 rounded-full bg-[#F4F0EA] border border-[#E8E1D8] self-start w-full sm:w-auto">
            {([
              ["calendar", isEn ? "Calendar" : "Calendario", CalendarDays],
              ["rooms", isEn ? "Rooms & availability" : "Habitaciones", LayoutList],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-5 py-2 rounded-full text-xs md:text-sm font-semibold transition-colors ${tab === key ? "bg-[#23211F] text-[#F9F7F4] shadow" : "text-[#23211F]/70 hover:text-[#23211F]"}`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          {tab === "calendar" && (
            <div className="flex items-center justify-between sm:justify-end gap-2 md:gap-3">
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label={isEn ? "Previous" : "Anterior"} className="w-9 h-9 rounded-full border border-[#E8E1D8] flex items-center justify-center text-[#23211F] disabled:opacity-30 hover:border-[#9B7E67] transition-colors">
                <ChevronLeft size={18} />
              </button>
              <p className="min-w-[150px] text-center font-serif text-lg md:text-xl text-[#23211F] capitalize" aria-live="polite">{title}</p>
              <button type="button" onClick={() => setPage((p) => Math.min(maxPage, p + 1))} disabled={page >= maxPage} aria-label={isEn ? "Next" : "Siguiente"} className="w-9 h-9 rounded-full border border-[#E8E1D8] flex items-center justify-center text-[#23211F] disabled:opacity-30 hover:border-[#9B7E67] transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        {error ? (
          <p role="alert" className="text-red-700 text-sm p-5">{error}</p>
        ) : !data || !catalog.length ? (
          <div role="status" className="p-5 space-y-3" aria-label={isEn ? "Loading availability" : "Cargando disponibilidad"}>
            {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-9 rounded-lg bg-[#F4F0EA] animate-pulse" />)}
          </div>
        ) : tab === "calendar" ? (
          <Timeline rows={rows} days={days} data={data} device={device} isEn={isEn} lang={lang} locale={locale} />
        ) : (
          <RoomsList rows={rows} data={data} device={device} isEn={isEn} lang={lang} locale={locale} />
        )}
      </div>

      <div className={`flex gap-4 ${device === "mobile" ? "flex-col" : "items-center justify-between"}`}>
        <Legend isEn={isEn} />
        {data && (
          <p className="text-xs md:text-sm text-gray-500">
            {freeRooms > 0
              ? isEn ? `${freeRooms} of ${rows.length} available tonight` : `${freeRooms} de ${rows.length} disponibles esta noche`
              : isEn ? "Fully booked tonight" : "Sin disponibilidad esta noche"}
          </p>
        )}
      </div>

      {rows.some((l) => l.kind === "whole_home") && rows.some((l) => l.kind === "room") && (
        <p className="flex items-start gap-2 text-xs md:text-sm text-gray-500 -mt-2">
          <Home size={15} className="text-[#9B7E67] shrink-0 mt-0.5" />
          {isEn
            ? "The whole house includes every room below. Rooms are booked one by one; when any room is taken, the whole house is not available those nights."
            : "La casa completa incluye todas las habitaciones de abajo. Las habitaciones se reservan por separado; si alguna está ocupada, la casa completa no está disponible esas noches."}
        </p>
      )}

      <motion.button
        type="button"
        onClick={onContinue}
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.98 }}
        className="w-full md:w-auto md:self-end md:px-10 py-4 rounded-full bg-[#23211F] text-[#F9F7F4] font-bold uppercase tracking-widest text-sm md:text-base flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-shadow"
      >
        {isEn ? "Search my dates & rooms" : "Buscar fechas y habitaciones"}
        <ArrowRight size={18} />
      </motion.button>
    </section>
  );
}

function Legend({ isEn }: { isEn: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-gray-500">
      <li className="flex items-center gap-2"><span className="w-4 h-3 rounded-sm border border-[#E8E1D8] bg-white" />{isEn ? "Available" : "Disponible"}</li>
      <li className="flex items-center gap-2"><span className="w-4 h-3 rounded-sm bg-[#9B7E67]/30" />{isEn ? "Booked" : "Reservado"}</li>
      <li className="flex items-center gap-2"><span className="w-4 h-3 rounded-sm cala-unavailable" />{isEn ? "Unavailable" : "No disponible"}</li>
    </ul>
  );
}

function segments(statuses: DayStatus[]) {
  const out: Array<{ start: number; length: number; status: DayStatus }> = [];
  statuses.forEach((status, i) => {
    const prev = out[out.length - 1];
    if (prev && prev.status === status && prev.start + prev.length === i) prev.length++;
    else out.push({ start: i, length: 1, status });
  });
  return out.filter((s) => s.status === "booked" || s.status === "blocked");
}

function Timeline({ rows, days, data, device, isEn, lang, locale }: { rows: BookingLodging[]; days: Date[]; data: AvailabilityOverviewData; device: Device; isEn: boolean; lang: string; locale: Locale }) {
  const scrolls = device !== "desktop";
  const nameWidth = device === "desktop" ? 230 : device === "tablet" ? 190 : 132;
  const roomCount = rows.filter((l) => l.kind === "room").length;
  const day = scrolls ? `${COLUMN[device]}px` : "minmax(0, 1fr)";
  const columns = `${nameWidth}px repeat(${days.length}, ${day})`;
  const todayIso = data.today;
  const labelMin = 3;
  const scroller = useRef<HTMLDivElement>(null);
  const sticky = scrolls ? "sticky left-0 z-20 bg-white shadow-[6px_0_8px_-6px_rgba(35,33,31,0.12)]" : "";
  // Open the month on today (or on its first day), like the CALA calendar.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !scrolls) return;
    const index = days.findIndex((d) => iso(d) === todayIso);
    el.scrollTo({ left: index > 0 ? (index - 1) * COLUMN[device] : 0 });
  }, [days, todayIso, scrolls, device]);
  return (
    <div ref={scroller} className={`pb-3 ${scrolls ? "overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] custom-scrollbar" : "px-3"}`}>
    <div role="table" aria-label={isEn ? "Availability calendar" : "Calendario de disponibilidad"} style={scrolls ? { width: nameWidth + days.length * COLUMN[device] } : undefined}>
      <div role="row" className="grid items-end border-b border-[#EFE9E1]" style={{ gridTemplateColumns: columns }}>
        <span role="columnheader" className={`self-stretch flex items-end pl-3 pb-3 text-xs md:text-sm font-semibold text-[#23211F] ${sticky}`}>{isEn ? "Rooms" : "Alojamiento"}</span>
        {days.map((d) => {
          const isToday = iso(d) === todayIso;
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <span role="columnheader" key={iso(d)} className="flex flex-col items-center gap-1 min-w-0 py-2 md:py-3">
              <span className={`text-[9px] md:text-[10px] uppercase ${weekend ? "text-[#9B7E67]" : "text-gray-400"}`}>{format(d, "EEEEEE", { locale }).replace(".", "")}</span>
              <span className={`w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full text-[11px] md:text-sm font-semibold ${isToday ? "bg-[#23211F] text-[#F9F7F4]" : "text-[#23211F]"}`}>{format(d, "d")}</span>
            </span>
          );
        })}
      </div>
      {rows.map((l) => {
        const statuses = days.map((d) => dayStatus(data, l.id, iso(d)));
        return (
          <div role="row" key={l.id} className={`grid items-center border-b last:border-b-0 ${l.kind === "whole_home" ? "border-[#E8DCCD] min-h-[52px] md:min-h-[56px]" : "border-[#F4F0EA] min-h-[44px] md:min-h-[46px]"}`} style={{ gridTemplateColumns: columns }}>
            {l.kind === "whole_home" ? (
              // The house heads the list, shaded like a group header.
              <div role="rowheader" className={`self-stretch flex items-center justify-between gap-1.5 pl-3 pr-2 min-w-0 ${sticky} !bg-[#F4F0EA]`}>
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`${device === "mobile" ? "w-6 h-6" : "w-7 h-7"} rounded-full bg-white text-[#9B7E67] flex items-center justify-center shrink-0`}><Home size={13} /></span>
                  <span className="min-w-0">
                    <span className={`block font-semibold text-[#23211F] truncate ${device === "mobile" ? "text-[12px]" : "text-sm"}`} title={lodgingText(l.name, lang)}>{device === "mobile" ? (isEn ? "Whole house" : "Casa completa") : lodgingText(l.name, lang)}</span>
                    <span className="block text-[10px] md:text-[11px] text-[#9B7E67] truncate">{device === "mobile" ? (isEn ? `${roomCount} rooms · ${l.capacity}p` : `${roomCount} hab. · ${l.capacity} pers.`) : isEn ? `Includes all ${roomCount} rooms` : `Incluye las ${roomCount} habitaciones`}</span>
                  </span>
                </span>
                {device !== "mobile" && <span className="flex items-center gap-0.5 text-[10px] md:text-xs text-gray-500 shrink-0"><Users size={12} />{l.capacity}</span>}
              </div>
            ) : (
              <div role="rowheader" className={`self-stretch flex items-center justify-between gap-1 pl-3 md:pl-4 pr-2 min-w-0 ${sticky}`}>
                <span className="flex items-center gap-1.5 min-w-0">
                  {roomCount > 0 && rows.some((r) => r.kind === "whole_home") && <CornerDownRight size={13} className="text-[#C9B99A] shrink-0" aria-hidden="true" />}
                  <span className={`text-[#23211F] min-w-0 ${device === "mobile" ? "text-[11px] leading-tight line-clamp-2" : "text-sm truncate"}`} title={lodgingText(l.name, lang)}>{lodgingText(l.name, lang)}</span>
                </span>
                <span className="flex items-center gap-0.5 text-[10px] md:text-xs text-gray-500 shrink-0"><Users size={12} />{l.capacity}</span>
              </div>
            )}
            <div className="relative grid h-full" style={{ gridColumn: `2 / span ${days.length}`, gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((d, i) => (
                <span key={i} role="cell" aria-label={`${format(d, "d MMM", { locale })}: ${statusLabel(statuses[i], isEn)}`} className={`border-l border-[#F4F0EA] ${l.kind === "whole_home" ? "bg-[#F8F4EF]" : statuses[i] === "past" ? "bg-[#FAF8F5]" : d.getDay() === 0 || d.getDay() === 6 ? "bg-[#FCFAF7]" : ""}`} style={{ gridColumn: i + 1, gridRow: 1 }} />
              ))}
              {segments(statuses).map((s) => (
                <span
                  key={s.start}
                  aria-hidden="true"
                  className={`self-center mx-0.5 h-6 md:h-7 rounded-full flex items-center text-[10px] md:text-xs font-semibold whitespace-nowrap ${scrolls ? "justify-start" : "justify-center overflow-hidden"} ${s.status === "booked" ? "bg-[#9B7E67]/25 text-[#5E4A3A]" : "cala-unavailable text-gray-500"}`}
                  style={{ gridColumn: `${s.start + 1} / span ${s.length}`, gridRow: 1 }}
                >
                  {/* While scrolling sideways the label stays next to the pinned names. */}
                  {s.length >= labelMin && <span className={scrolls ? "sticky px-3" : ""} style={scrolls ? { left: nameWidth } : undefined}>{statusLabel(s.status, isEn)}</span>}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}

const statusLabel = (status: DayStatus, isEn: boolean) =>
  status === "booked" ? (isEn ? "Booked" : "Reservado") : status === "blocked" ? (isEn ? "Unavailable" : "No disponible") : status === "past" ? (isEn ? "Past" : "Pasado") : isEn ? "Available" : "Disponible";

function RoomsList({ rows, data, device, isEn, lang, locale }: { rows: BookingLodging[]; data: AvailabilityOverviewData; device: Device; isEn: boolean; lang: string; locale: Locale }) {
  const start = localDate(data.today);
  const strip = Array.from({ length: device === "mobile" ? 14 : 21 }, (_, i) => addDays(start, i));
  const house = rows.find((l) => l.kind === "whole_home");
  const rooms = rows.filter((l) => l.kind !== "whole_home");
  const card = (l: BookingLodging) => {
        const statuses = strip.map((d) => dayStatus(data, l.id, iso(d)));
        const freeTonight = statuses[0] === "free";
        const nextFree = strip.find((_, i) => statuses[i] === "free");
        const freeCount = statuses.filter((s) => s === "free").length;
        return (
          <li key={l.id} className={`flex gap-3 md:gap-4 p-3 rounded-2xl border ${l.kind === "whole_home" ? `border-[#E2D5C5] bg-[#F7F2EC] ${device === "mobile" ? "flex-col" : ""}` : "border-[#EFE9E1] bg-[#FDFCFA]"}`}>
            {l.images[0] ? (
              <img src={l.images[0]} alt="" className={`rounded-xl object-cover shrink-0 ${l.kind === "whole_home" && device === "mobile" ? "w-full h-36" : l.kind === "whole_home" && device === "desktop" ? "w-36 h-28" : "w-20 h-20 md:w-24 md:h-24"}`} />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-[#EAE5DD] flex items-center justify-center shrink-0">
                {l.kind === "whole_home" ? <Home className="text-[#9B7E67]" /> : <BedDouble className="text-[#9B7E67]" />}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {l.kind === "whole_home" && <p className="text-[10px] font-bold uppercase tracking-widest text-[#9B7E67] flex items-center gap-1 mb-0.5"><Home size={12} className="shrink-0" />{isEn ? `Whole house · ${rooms.length} rooms` : `Casa completa · ${rooms.length} habitaciones`}</p>}
                  <h4 className="font-serif text-lg leading-tight text-[#23211F]">{lodgingText(l.name, lang)}</h4>
                </div>
                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${freeTonight ? "bg-[#E7EFE6] text-[#3F5E3C]" : "bg-[#F4F0EA] text-[#7A6A5B]"}`}>
                  {freeTonight ? (isEn ? "Free tonight" : "Libre hoy") : isEn ? "Busy tonight" : "Ocupada hoy"}
                </span>
              </div>
              <p className="text-xs md:text-sm text-gray-500 flex items-center gap-1.5 flex-wrap">
                <Users size={13} /> {isEn ? "Up to" : "Hasta"} {l.capacity} {isEn ? "guests" : "personas"}
                {lodgingText(l.beds, lang) && <span>· {lodgingText(l.beds, lang)}</span>}
              </p>
              <p className="text-xs md:text-sm font-semibold text-[#9B7E67]">
                {isEn ? "From " : "Desde "}{lodgingPrice(l.fromRateMinor ?? l.baseRateMinor, l.currency, lang)} / {isEn ? "night" : "noche"}
              </p>
              <div className="flex gap-[2px] pt-1" aria-hidden="true">
                {statuses.map((s, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${s === "free" ? "bg-[#9FB59B]" : s === "booked" ? "bg-[#9B7E67]/40" : "bg-gray-200"}`} />
                ))}
              </div>
              <p className="text-[11px] text-gray-500">
                {freeTonight
                  ? isEn ? `${freeCount} of the next ${strip.length} nights free` : `${freeCount} de las próximas ${strip.length} noches libres`
                  : nextFree
                    ? isEn ? `Next free night: ${format(nextFree, "EEE d MMM", { locale })}` : `Próxima noche libre: ${format(nextFree, "EEE d MMM", { locale })}`
                    : isEn ? `No free nights in the next ${strip.length} days` : `Sin noches libres en los próximos ${strip.length} días`}
              </p>
            </div>
          </li>
        );
  };
  return (
    <div className="p-3 md:p-4 space-y-3">
      {house && <ul>{card(house)}</ul>}
      {rooms.length > 0 && (
        <div className={house ? "ml-2 md:ml-4 pl-3 md:pl-4 border-l-2 border-[#E8DCCD]" : ""}>
          {house && (
            <p className="flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">
              <CornerDownRight size={13} className="text-[#C9B99A]" />
              {isEn ? "Rooms of the house · booked separately" : "Habitaciones de la casa · se reservan por separado"}
            </p>
          )}
          <ul className={`grid gap-3 ${device === "desktop" ? "grid-cols-2" : "grid-cols-1"}`}>{rooms.map(card)}</ul>
        </div>
      )}
    </div>
  );
}

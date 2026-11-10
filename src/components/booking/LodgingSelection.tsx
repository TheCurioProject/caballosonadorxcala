"use client";
import { Home, BedDouble, Users, ArrowRight } from "lucide-react";
import { lodgingText, lodgingPrice, type Lodging } from "@/lib/lodgings";
export type BookingLodging = Lodging & { images: string[] };
export function LodgingSelection({
  step,
  catalog,
  isEn,
  onSelect,
}: {
  step: "stay_type" | "accommodation";
  catalog: BookingLodging[];
  isEn: boolean;
  /** Kept for callers; both stay types are now chosen on the first step. */
  onMode?: (mode: "whole_home" | "room") => void;
  onSelect: (lodging: BookingLodging) => void;
}) {
  const lang = isEn ? "en" : "es";
  const whole = catalog.find((l) => l.kind === "whole_home");
  const rooms = catalog.filter((l) => l.kind === "room");
  return (
    <section
      className="space-y-5 pb-12"
      aria-label={isEn ? "Choose your accommodation" : "Elige tu alojamiento"}
    >
      <div>
        <p className="text-xs tracking-[0.2em] uppercase text-[#9B7E67] font-semibold mb-3">
          CASA CABALLO SOÑADOR
        </p>
        <h3 className="text-3xl font-serif text-[#23211F]">
          {step === "stay_type"
            ? isEn
              ? "Choose your room"
              : "Elige tu habitación"
            : isEn
              ? "Find your room"
              : "Elige tu habitación"}
        </h3>
        <p className="text-gray-500 mt-3 leading-relaxed">
          {step === "stay_type"
            ? isEn
              ? "Book one of our rooms, or the entire house for your group. Each one has its own availability and rate."
              : "Reserva una de nuestras habitaciones o la casa completa para tu grupo. Cada una tiene su disponibilidad y tarifa."
            : isEn
              ? "Each room has its own availability and rate."
              : "Cada habitación tiene su disponibilidad y tarifa."}
        </p>
      </div>
      {step === "stay_type" ? (
        <div className="space-y-6">
          {rooms.length > 0 && (
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-[#23211F]">
                <BedDouble size={18} className="text-[#9B7E67]" />
                {isEn ? "Rooms" : "Habitaciones"}
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                {rooms.map((l) => (
                  <RoomCard
                    key={l.id}
                    lodging={l}
                    isEn={isEn}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          )}
          {whole && (
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-[#23211F]">
                <Home size={18} className="text-[#9B7E67]" />
                {isEn ? "Travelling as a group?" : "¿Vienen en grupo?"}
              </h4>
              <button
                type="button"
                onClick={() => onSelect(whole)}
                className="w-full text-left bg-white rounded-2xl border border-[#D9D1C6] overflow-hidden hover:border-[#9B7E67] focus-visible:ring-2 focus-visible:ring-[#9B7E67] transition-colors sm:flex"
              >
                {whole.images[0] ? (
                  <img
                    src={whole.images[0]}
                    alt={lodgingText(whole.name, lang)}
                    className="w-full h-40 sm:h-auto sm:w-48 object-cover shrink-0"
                  />
                ) : (
                  <div className="h-24 sm:h-auto sm:w-40 bg-[#EAE5DD] flex items-center justify-center shrink-0">
                    <Home size={34} className="text-[#9B7E67]" />
                  </div>
                )}
                <div className="p-5 space-y-2 flex-1">
                  <p className="text-[11px] tracking-[0.18em] uppercase text-[#9B7E67] font-semibold">
                    {isEn ? "Private stay" : "Estancia privada"}
                  </p>
                  <h4 className="font-serif text-2xl text-[#23211F]">
                    {isEn ? "Entire house" : "Casa completa"}
                  </h4>
                  <p className="text-sm text-gray-500 flex gap-2 items-center">
                    <Users size={15} />
                    {whole.capacity} {isEn ? "guests" : "huéspedes"} ·{" "}
                    {isEn
                      ? "all rooms and shared areas"
                      : "todas las habitaciones y áreas comunes"}
                  </p>
                  <div className="flex justify-between items-center gap-4 pt-1">
                    <strong className="text-[#9B7E67]">
                      {isEn ? "From " : "Desde "}
                      {lodgingPrice(
                        whole.fromRateMinor ?? whole.baseRateMinor,
                        whole.currency,
                        lang,
                      )}
                      <small className="font-normal">
                        {" "}
                        / {isEn ? "night" : "noche"}
                      </small>
                    </strong>
                    <ArrowRight size={20} />
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rooms.map((l) => (
            <RoomCard key={l.id} lodging={l} isEn={isEn} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  );
}

function RoomCard({
  lodging: l,
  isEn,
  onSelect,
}: {
  lodging: BookingLodging;
  isEn: boolean;
  onSelect: (lodging: BookingLodging) => void;
}) {
  const lang = isEn ? "en" : "es";
  return (
    <button
      type="button"
      onClick={() => onSelect(l)}
      className="text-left bg-white rounded-2xl border border-[#D9D1C6] overflow-hidden hover:border-[#9B7E67] focus-visible:ring-2 focus-visible:ring-[#9B7E67] transition-colors"
    >
      {l.images[0] ? (
        <img
          src={l.images[0]}
          alt={lodgingText(l.name, lang)}
          className="w-full h-36 object-cover"
        />
      ) : (
        <div className="h-24 bg-[#EAE5DD] flex items-center justify-center">
          <BedDouble size={34} className="text-[#9B7E67]" />
        </div>
      )}
      <div className="p-4 space-y-3">
        <h4 className="font-serif text-xl text-[#23211F]">
          {lodgingText(l.name, lang)}
        </h4>
        <p className="text-sm text-gray-500 flex gap-2 items-center">
          <Users size={15} />
          {l.capacity} {isEn ? "guests" : "huéspedes"} ·{" "}
          {lodgingText(l.beds, lang)}
        </p>
        <p className="text-sm text-gray-500 line-clamp-2">
          {lodgingText(l.description, lang)}
        </p>
        <p className="text-[#9B7E67] font-semibold text-sm">
          {isEn ? "From " : "Desde "}
          {lodgingPrice(
            l.fromRateMinor ?? l.baseRateMinor,
            l.currency,
            lang,
          )} / {isEn ? "night" : "noche"}
        </p>
        <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
          {isEn ? "View availability" : "Ver disponibilidad"}
          <ArrowRight size={16} />
        </span>
      </div>
    </button>
  );
}

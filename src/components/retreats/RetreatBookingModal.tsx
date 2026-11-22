'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, CalendarDays, User, Users, BedDouble, Bath, ChevronLeft, ChevronRight, CreditCard, Check } from 'lucide-react';
import { CountryCodeDropdown } from '@/components/booking/CountryCodeDropdown';
import { ActionLoadingScreen } from '@/components/ui/ActionLoadingScreen';
import { useScrollLock } from '@/hooks/useScrollLock';
import { lodgingDisplayName } from '@/lib/lodgings';
import { RETREAT_MAX_GUESTS, retreatAvailability, retreatDates, retreatNights, retreatPrice, retreatText, retreatTotal, type Bilingual } from '@/lib/retreats';

type Lang = 'es' | 'en';
type Step = 'guests' | 'room' | 'summary';
interface Room {
  id: string;
  roomNumber: number | null;
  name: Bilingual;
  description: Bilingual;
  beds: Bilingual;
  bathrooms: number;
  amenities: string[];
  capacity: number;
  available: boolean;
  /** Lodging for the retreat's nights at CALA's rates (null: not priced separately). */
  lodgingMinor: number | null;
  images: string[];
}
interface Offer { onSale: boolean; remaining: number; rooms: Room[] }
export interface RetreatSummary { id: number; title: string; startsOn: string | null; endsOn: string | null; priceMinor: number; imageUrl: string | null }

/** Retreat price + the room's lodging at CALA's rates for the retreat's nights. */
function PriceBreakdown({ isEn, lang, retreatMinor, lodgingMinor, nights }: { isEn: boolean; lang: Lang; retreatMinor: number; lodgingMinor: number | null; nights: number }) {
  if (lodgingMinor == null)
    return (
      <div>
        <p className="font-serif text-2xl text-[#23211F]">{retreatPrice(retreatMinor, lang)}</p>
        <p className="text-xs uppercase tracking-widest text-gray-400">{isEn ? 'Retreat price' : 'Precio del retiro'}</p>
      </div>
    );
  return (
    <div className="min-w-0">
      <p className="font-serif text-2xl text-[#23211F]">{retreatPrice(retreatMinor + lodgingMinor, lang)}</p>
      <p className="text-xs text-gray-500 break-words">
        {isEn
          ? `Retreat ${retreatPrice(retreatMinor, lang)} + lodging ${retreatPrice(lodgingMinor, lang)} (${nights} ${nights === 1 ? 'night' : 'nights'})`
          : `Retiro ${retreatPrice(retreatMinor, lang)} + hospedaje ${retreatPrice(lodgingMinor, lang)} (${nights} ${nights === 1 ? 'noche' : 'noches'})`}
      </p>
    </div>
  );
}

/** Small Cloudinary rendition for the compact carousel. */
const thumb = (url: string, width = 720) => url.includes('/image/upload/') ? url.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_fill,w_${width}/`) : url;

function Carousel({ images, alt, isEn }: { images: string[]; alt: string; isEn: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const go = (to: number) => {
    const el = track.current;
    if (!el) return;
    const next = (to + images.length) % images.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  };
  if (!images.length) return null;
  return (
    <div className="relative rounded-2xl overflow-hidden bg-[#EDE8E2]">
      <div
        ref={track}
        onScroll={e => { const el = e.currentTarget; setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden h-44 sm:h-52"
      >
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src + i} src={thumb(src)} alt={`${alt} · ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} className="w-full h-full object-cover shrink-0 snap-center" />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button type="button" onClick={() => go(index - 1)} aria-label={isEn ? 'Previous photo' : 'Foto anterior'} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 text-[#23211F] flex items-center justify-center shadow hover:bg-white">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label={isEn ? 'Next photo' : 'Foto siguiente'} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 text-[#23211F] flex items-center justify-center shadow hover:bg-white">
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`} />)}
          </div>
        </>
      )}
    </div>
  );
}

export function RetreatBookingModal({ retreat, lang, onClose }: { retreat: RetreatSummary; lang: Lang; onClose: () => void }) {
  const isEn = lang === 'en';
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>('guests');
  const [guests, setGuests] = useState<number | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+52');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  useScrollLock(true);
  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/retreats/${retreat.id}/`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOffer(data);
      return data as Offer;
    } catch {
      setLoadError(isEn ? 'We could not load the rooms. Please try again.' : 'No pudimos cargar las habitaciones. Inténtalo de nuevo.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [retreat.id, isEn]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [step]);

  const rooms = useMemo(() => (offer?.rooms ?? []).filter(r => r.available && guests !== null && r.capacity >= guests), [offer, guests]);
  const room = offer?.rooms.find(r => r.id === roomId) ?? null;
  const nights = retreatNights(retreat.startsOn, retreat.endsOn);
  const dates = retreatDates(retreat.startsOn, retreat.endsOn, lang);
  // The retreat's own price; the chosen room is added at CALA's rates.
  const retreatOnly = retreatPrice(retreat.priceMinor, lang);
  const priced = (offer?.rooms ?? []).filter(r => r.available && r.lodgingMinor != null);
  const fromMinor = priced.length ? Math.min(...priced.map(r => retreatTotal(retreat.priceMinor, r.lodgingMinor))) : null;
  const totalMinor = room ? retreatTotal(retreat.priceMinor, room.lodgingMinor) : null;
  const price = totalMinor != null
    ? retreatPrice(totalMinor, lang)
    : fromMinor != null
      ? `${isEn ? 'From' : 'Desde'} ${retreatPrice(fromMinor, lang)}`
      : retreatOnly;
  const separateLodging = (offer?.rooms ?? []).some(r => r.lodgingMinor != null);
  const totalNote = !separateLodging
    ? (isEn ? 'Retreat price' : 'Precio del retiro')
    : room
      ? (isEn ? 'Retreat + lodging' : 'Retiro + hospedaje')
      : (isEn ? 'Retreat + lodging of the room you choose' : 'Retiro + hospedaje de la habitación que elijas');
  const remaining = offer?.remaining ?? 0;
  const soldOut = Boolean(offer) && (!offer!.onSale || remaining === 0);
  const digits = phone.replace(/\D/g, '');
  const nameOk = name.trim().length >= 2;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneOk = digits.length >= 7 && digits.length <= 15;
  const formOk = nameOk && emailOk && phoneOk;
  const stepNumber = step === 'guests' ? 1 : step === 'room' ? 2 : 3;
  const peopleLabel = (n: number) => isEn ? `${n} ${n === 1 ? 'guest' : 'guests'}` : `${n} ${n === 1 ? 'persona' : 'personas'}`;

  const back = () => {
    setError('');
    if (step === 'summary') setStep('room');
    else if (step === 'room') setStep('guests');
  };

  async function checkout() {
    if (!room || !guests || !formOk || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/retreats/checkout/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retreatId: retreat.id, lodgingId: room.id, guests, guestName: name.trim(), guestEmail: email.trim(),
          guestPhone: `${countryCode} ${digits}`, priceMinor: retreatTotal(retreat.priceMinor, room.lodgingMinor), lang,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setBusy(false);
      setError(data.error || (isEn ? 'We could not start the payment. Please try again.' : 'No pudimos iniciar el pago. Inténtalo de nuevo.'));
      if (data.code === 'RETREAT_PRICE_CHANGED') {
        // CALA's rates changed meanwhile: show the new prices and let the guest choose again.
        await load();
        setRoomId(null);
        setStep('room');
      } else if (data.code === 'RETREAT_ROOM_TAKEN' || data.code === 'RETREAT_SOLD_OUT' || data.code === 'RETREAT_ROOM_CAPACITY') {
        const fresh = await load();
        setRoomId(null);
        setStep(fresh && fresh.remaining > 0 ? 'room' : 'guests');
      }
    } catch {
      setBusy(false);
      setError(isEn ? 'Connection error. Please try again.' : 'Error de conexión. Inténtalo de nuevo.');
    }
  }

  if (!mounted) return null;

  const detail = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex items-start gap-4 text-base font-light text-gray-300">
      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="font-bold text-white mb-1 uppercase tracking-widest text-[10px]">{label}</p>
        <div className="break-words">{value}</div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center md:p-6" role="presentation">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-[#23211F]/70 md:backdrop-blur-md" onClick={() => !busy && onClose()} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={isEn ? 'Book this retreat' : 'Reserva este retiro'}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        className="relative w-full md:max-w-5xl bg-[#F9F7F4] rounded-t-[2rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[100dvh] md:h-[680px] md:max-h-[90vh] text-[#23211F]"
      >
        <button onClick={onClose} disabled={busy} aria-label={isEn ? 'Close' : 'Cerrar'} className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 flex items-center justify-center rounded-full bg-black/10 md:bg-transparent hover:bg-gray-200 transition-colors z-30 text-gray-700">
          <X size={20} />
        </button>

        {/* Summary panel (desktop) */}
        <aside className="hidden md:flex w-5/12 bg-[#23211F] text-[#F9F7F4] flex-col justify-between p-10 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 pointer-events-none opacity-10">
            <svg viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
              <path d="M-100,200 C200,0 600,400 900,200" fill="none" stroke="#F9F7F4" strokeWidth="2" />
              <path d="M-100,260 C200,60 600,460 900,260" fill="none" stroke="#F9F7F4" strokeWidth="1" />
              <path d="M-100,820 C300,1020 500,620 900,820" fill="none" stroke="#9B7E67" strokeWidth="2" />
            </svg>
          </div>
          <div className="relative z-10 min-h-0 flex flex-col">
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#9B7E67] mb-2">{isEn ? 'Retreat' : 'Retiro'} · Casa Caballo Soñador</p>
            <h2 className="text-3xl lg:text-4xl font-serif leading-tight break-words">{retreat.title}</h2>
            <div className="mt-8 space-y-5 overflow-y-auto pr-2">
              {dates && detail(<CalendarDays size={16} className="text-[#9B7E67]" />, isEn ? 'Dates' : 'Fechas', <>{dates}{nights > 0 && <span className="text-gray-500"> · {nights} {isEn ? 'nights' : 'noches'}</span>}</>)}
              {detail(<User size={16} className="text-[#9B7E67]" />, isEn ? 'Guests' : 'Personas', guests ? peopleLabel(guests) : '—')}
              {detail(<BedDouble size={16} className="text-[#9B7E67]" />, isEn ? 'Room' : 'Habitación', room ? lodgingDisplayName(room, lang) : '—')}
            </div>
          </div>
          <div className="relative z-10 pt-6 mt-6 border-t border-white/10">
            <div className="flex justify-between items-end gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{isEn ? 'Total' : 'Total'}</p>
                <p className="text-[10px] uppercase tracking-widest text-[#9B7E67] font-bold mt-2 max-w-[190px]">{totalNote}</p>
              </div>
              <span className="font-serif text-3xl text-[#9B7E67] text-right">{price}</span>
            </div>
          </div>
        </aside>

        {/* Steps */}
        <section className="w-full md:w-7/12 flex flex-col min-h-0 flex-1">
          <div className="shrink-0 px-6 pt-6 md:px-10 md:pt-10 pb-2 pr-16">
            <div className="flex items-center gap-4 min-h-[40px]">
              {step !== 'guests' && (
                <button type="button" onClick={back} disabled={busy} className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#9B7E67] hover:text-[#23211F] transition-colors">
                  <ArrowLeft size={16} /> {isEn ? 'Back' : 'Atrás'}
                </button>
              )}
              <span className="text-[11px] uppercase tracking-[0.25em] font-bold text-gray-400 ml-auto">{isEn ? 'Step' : 'Paso'} {stepNumber}/3</span>
            </div>
            <div className="mt-3 h-1 bg-[#23211F]/10 rounded-full overflow-hidden">
              <motion.div className="h-full bg-[#9B7E67]" animate={{ width: `${(stepNumber / 3) * 100}%` }} />
            </div>
            <p className="md:hidden mt-4 font-serif text-xl leading-tight break-words">{retreat.title}</p>
            {dates && <p className="md:hidden text-sm text-gray-500">{dates}</p>}
          </div>

          <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain px-6 md:px-10 pb-8 pt-4">
            <AnimatePresence mode="wait">
              {step === 'guests' && (
                <motion.div key="guests" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}>
                  <h3 className="text-3xl font-serif mb-2">{isEn ? 'How many are you?' : '¿Cuántas personas son?'}</h3>
                  <p className="text-gray-500 mb-8">{isEn ? `Up to ${RETREAT_MAX_GUESTS} guests per booking. You will share one room.` : `Hasta ${RETREAT_MAX_GUESTS} personas por reserva. Compartirán una habitación.`}</p>
                  {loading && !offer ? (
                    <p role="status" className="text-gray-500">{isEn ? 'Checking availability…' : 'Consultando disponibilidad…'}</p>
                  ) : loadError ? (
                    <div className="space-y-4"><p role="alert" className="text-red-700">{loadError}</p><button type="button" onClick={() => void load()} className="underline text-[#9B7E67]">{isEn ? 'Try again' : 'Reintentar'}</button></div>
                  ) : soldOut ? (
                    <p className="text-lg text-[#23211F]/70">{isEn ? 'This retreat is sold out.' : 'Este retiro está agotado.'}</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        {Array.from({ length: RETREAT_MAX_GUESTS }, (_, i) => i + 1).map(n => {
                          const fits = (offer?.rooms ?? []).some(r => r.available && r.capacity >= n);
                          return (
                            <button
                              key={n}
                              type="button"
                              disabled={!fits}
                              onClick={() => { setGuests(n); setExpanded(null); setRoomId(null); setError(''); setStep('room'); }}
                              className={`rounded-3xl border p-5 sm:p-6 text-left transition-all ${guests === n ? 'border-[#23211F] bg-white shadow-md' : 'border-[#23211F]/15 bg-white hover:border-[#9B7E67] hover:shadow-sm'} disabled:opacity-40 disabled:hover:shadow-none disabled:hover:border-[#23211F]/15`}
                            >
                              {n === 1 ? <User size={26} className="text-[#9B7E67] mb-4" /> : <Users size={26} className="text-[#9B7E67] mb-4" />}
                              <span className="block font-serif text-2xl">{peopleLabel(n)}</span>
                              {!fits && <span className="block text-xs text-gray-500 mt-1">{isEn ? 'No room available' : 'Sin habitación disponible'}</span>}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-6 text-sm font-bold text-[#9B7E67]">{retreatAvailability(remaining, lang)}</p>
                    </>
                  )}
                </motion.div>
              )}

              {step === 'room' && (
                <motion.div key="room" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}>
                  <h3 className="text-3xl font-serif mb-2">{isEn ? 'Choose your room' : 'Escoge tu habitación'}</h3>
                  <p className="text-gray-500 mb-6">{isEn ? 'Rooms free for the retreat. Tap one to see it.' : 'Habitaciones libres para el retiro. Toca una para verla.'}</p>
                  {error && <p role="alert" className="mb-4 rounded-2xl bg-red-50 text-red-700 px-4 py-3">{error}</p>}
                  {loading && <p role="status" className="text-gray-500">{isEn ? 'Checking availability…' : 'Consultando disponibilidad…'}</p>}
                  {!loading && rooms.length === 0 && (
                    <p className="text-lg text-[#23211F]/70">{isEn ? 'No room is free for that number of guests anymore.' : 'Ya no queda ninguna habitación libre para ese número de personas.'}</p>
                  )}
                  <div className="space-y-3">
                    {rooms.map(r => {
                      const open = expanded === r.id;
                      const label = lodgingDisplayName(r, lang);
                      const beds = retreatText(r.beds, lang);
                      return (
                        <div key={r.id} className={`rounded-3xl border bg-white overflow-hidden transition-shadow ${open ? 'border-[#23211F]/30 shadow-md' : 'border-[#23211F]/10 hover:shadow-sm'}`}>
                          <button type="button" onClick={() => setExpanded(open ? null : r.id)} aria-expanded={open} className="w-full flex items-center gap-4 p-3 sm:p-4 text-left">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-[#EDE8E2] shrink-0">
                              {r.images[0] && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb(r.images[0], 200)} alt="" className="w-full h-full object-cover" loading="lazy" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-serif text-lg sm:text-xl leading-snug break-words">{label}</p>
                              <p className="text-sm text-gray-500 mt-0.5">{peopleLabel(r.capacity)} {isEn ? 'max.' : 'máx.'}{beds && ` · ${beds}`}</p>
                            </div>
                            <ChevronRight size={20} className={`shrink-0 text-[#9B7E67] transition-transform ${open ? 'rotate-90' : ''}`} />
                          </button>
                          <AnimatePresence initial={false}>
                            {open && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                                <div className="px-3 sm:px-4 pb-4 space-y-4">
                                  <Carousel images={r.images} alt={label} isEn={isEn} />
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                                    <span className="flex items-center gap-1.5"><Users size={15} className="text-[#9B7E67]" />{peopleLabel(r.capacity)} {isEn ? 'max.' : 'máx.'}</span>
                                    {beds && <span className="flex items-center gap-1.5"><BedDouble size={15} className="text-[#9B7E67]" />{beds}</span>}
                                    <span className="flex items-center gap-1.5"><Bath size={15} className="text-[#9B7E67]" />{r.bathrooms} {isEn ? (r.bathrooms === 1 ? 'bathroom' : 'bathrooms') : (r.bathrooms === 1 ? 'baño' : 'baños')}</span>
                                  </div>
                                  {retreatText(r.description, lang) && <p className="text-sm text-gray-600 leading-relaxed line-clamp-4 whitespace-pre-line">{retreatText(r.description, lang)}</p>}
                                  {r.amenities.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {r.amenities.slice(0, 6).map(a => <span key={a} className="text-xs bg-[#F9F7F4] border border-[#23211F]/10 rounded-full px-2.5 py-1 text-gray-600">{a}</span>)}
                                    </div>
                                  )}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
                                    <PriceBreakdown isEn={isEn} lang={lang} retreatMinor={retreat.priceMinor} lodgingMinor={r.lodgingMinor} nights={nights} />
                                    <button
                                      type="button"
                                      onClick={() => { setRoomId(r.id); setError(''); setStep('summary'); }}
                                      className="inline-flex items-center justify-center gap-2 bg-[#23211F] hover:bg-[#9B7E67] text-white px-5 py-3.5 rounded-full text-sm font-bold uppercase tracking-widest transition-colors"
                                    >
                                      {isEn ? 'Continue with this room' : 'Continuar con esta habitación'} <ArrowRight size={16} />
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {step === 'summary' && room && guests && (
                <motion.div key="summary" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}>
                  <h3 className="text-3xl font-serif mb-6">{isEn ? 'Summary' : 'Resumen'}</h3>
                  <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-sm space-y-4">
                    <div className="flex gap-4 items-start pb-4 border-b border-gray-100">
                      {room.images[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb(room.images[0], 200)} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-serif text-xl break-words">{retreat.title}</p>
                        {dates && <p className="text-gray-500">{dates}{nights > 0 && ` · ${nights} ${isEn ? 'nights' : 'noches'}`}</p>}
                        <p className="text-gray-500 break-words">{lodgingDisplayName(room, lang)} · {peopleLabel(guests)}</p>
                      </div>
                    </div>
                    <form onSubmit={e => { e.preventDefault(); void checkout(); }} className="space-y-4" noValidate>
                      <p className="font-bold">{isEn ? 'Your details' : 'Tus datos'}</p>
                      <label className="block">
                        <span className="text-xs text-[#9B7E67] font-bold tracking-widest uppercase">{isEn ? 'Full name' : 'Nombre completo'}</span>
                        <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" className="mt-1 w-full h-12 px-4 rounded-2xl bg-[#F9F7F4] border border-gray-200 outline-none focus:border-[#9B7E67] focus:ring-2 focus:ring-[#9B7E67]/20" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-[#9B7E67] font-bold tracking-widest uppercase">{isEn ? 'E-mail' : 'Correo electrónico'}</span>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" aria-invalid={email.length > 0 && !emailOk} className="mt-1 w-full h-12 px-4 rounded-2xl bg-[#F9F7F4] border border-gray-200 outline-none focus:border-[#9B7E67] focus:ring-2 focus:ring-[#9B7E67]/20" />
                        {email.length > 3 && !emailOk && <span className="text-xs text-red-600">{isEn ? 'Invalid e-mail format' : 'Formato de correo inválido'}</span>}
                      </label>
                      <div className="flex gap-3 items-end pt-6">
                        <div className="w-[38%] sm:w-1/3 min-w-0"><CountryCodeDropdown label={isEn ? 'Code' : 'Prefijo'} value={countryCode} onChange={setCountryCode} /></div>
                        <label className="flex-1 min-w-0">
                          <span className="text-xs text-[#9B7E67] font-bold tracking-widest uppercase">{isEn ? 'Phone' : 'Teléfono'}</span>
                          <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d\s]/g, '').slice(0, 18))} autoComplete="tel-national" className="mt-1 w-full h-12 px-4 rounded-2xl bg-[#F9F7F4] border border-gray-200 outline-none focus:border-[#9B7E67] focus:ring-2 focus:ring-[#9B7E67]/20" />
                        </label>
                      </div>
                      <div className="pt-4 border-t border-gray-100 space-y-2">
                        {room.lodgingMinor != null && (
                          <>
                            <div className="flex justify-between gap-4 text-sm text-gray-600"><span>{isEn ? 'Retreat' : 'Retiro'}</span><span>{retreatOnly}</span></div>
                            <div className="flex justify-between gap-4 text-sm text-gray-600"><span className="min-w-0 break-words">{isEn ? `Lodging · ${nights} ${nights === 1 ? 'night' : 'nights'}` : `Hospedaje · ${nights} ${nights === 1 ? 'noche' : 'noches'}`}</span><span className="shrink-0">{retreatPrice(room.lodgingMinor, lang)}</span></div>
                          </>
                        )}
                        <div className="flex justify-between items-end gap-4">
                          <div>
                            <p className="font-bold text-2xl">{isEn ? 'Total' : 'Total'}</p>
                            <p className="text-xs uppercase tracking-widest text-gray-400">{totalNote}</p>
                          </div>
                          <p className="font-serif text-2xl sm:text-3xl text-right">{price}</p>
                        </div>
                      </div>
                      <p className="text-[11px] uppercase tracking-widest text-[#9B7E67] font-bold">
                        {isEn ? '* Stripe will handle the currency conversion at checkout' : '* Stripe aplicará el tipo de cambio correspondiente al momento del pago'}
                      </p>
                      {error && <p role="alert" className="rounded-2xl bg-red-50 text-red-700 px-4 py-3">{error}</p>}
                      {!formOk && (name || email || phone) && (
                        <p className="text-amber-600 text-xs font-bold">{isEn ? 'Please fill in your name, e-mail and phone.' : 'Completa tu nombre, correo y teléfono.'}</p>
                      )}
                      <button type="submit" disabled={!formOk || busy} className="w-full inline-flex items-center justify-center gap-2 bg-[#23211F] hover:bg-[#9B7E67] text-white h-14 rounded-full text-sm font-bold uppercase tracking-widest transition-colors disabled:opacity-40 disabled:hover:bg-[#23211F]">
                        {busy ? <Check size={18} /> : <CreditCard size={18} />} Checkout
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="h-24 md:hidden" />
          </div>

          {/* Mobile total */}
          <div className="md:hidden shrink-0 bg-white border-t border-gray-100 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex justify-between items-center gap-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{isEn ? 'Total' : 'Total'} · {totalNote}</p>
              <p className="font-serif text-xl leading-tight">{price}</p>
            </div>
            {room && <p className="text-xs text-gray-500 text-right truncate max-w-[45%]">{lodgingDisplayName(room, lang)}</p>}
          </div>
        </section>
        <ActionLoadingScreen isOpen={busy} message={isEn ? 'Redirecting to secure payment' : 'Redirigiendo al pago seguro'} subMessage={isEn ? 'Payments processed by Stripe' : 'Pagos procesados por Stripe'} />
      </motion.div>
    </div>,
    document.body,
  );
}

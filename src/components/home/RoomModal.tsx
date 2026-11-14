'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion';
import { X, BedDouble, Users, Bath, Wifi, Check, ChevronLeft, ChevronRight, Maximize2, MoveHorizontal } from 'lucide-react';
import { useBooking } from '@/context/BookingContext';
import { useDictionary } from '@/i18n/DictionaryContext';
import { useScrollLock } from '@/hooks/useScrollLock';
import { RoomAvailabilityCalendar } from './RoomAvailabilityCalendar';

/**
 * Expanded room card. One layout per device:
 *  - phone: full-screen sheet, photos on top, booking bar pinned at the bottom;
 *  - tablet: tall card, photos on top and two columns of content underneath;
 *  - desktop: wide card, photos on the left and the room on the right.
 * Guests move between rooms by swiping (phones and tablets) or with the arrows
 * next to the room name (desktop, also the keyboard arrows).
 */
interface RoomModalProps {
  rooms: any[];
  /** Index of the open room in `rooms`, or null when closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const fallbackLabels = {
  es: {
    position: 'Habitación {current} de {total}',
    swipeHint: 'Desliza para ver otra habitación',
    arrowsHint: 'Usa las flechas para ver otra habitación',
    previous: 'Habitación anterior',
    next: 'Habitación siguiente',
    close: 'Cerrar',
    photo: 'Foto {current} de {total}',
    previousPhoto: 'Foto anterior',
    nextPhoto: 'Foto siguiente',
    expand: 'Ver fotos en grande',
    book: 'Reservar esta habitación',
    guests: 'huéspedes',
    bathroom: 'baño',
    bathrooms: 'baños',
    noPhotos: 'Fotos de la habitación próximamente',
    amenities: 'Comodidades',
  },
  en: {
    position: 'Room {current} of {total}',
    swipeHint: 'Swipe to see another room',
    arrowsHint: 'Use the arrows to see another room',
    previous: 'Previous room',
    next: 'Next room',
    close: 'Close',
    photo: 'Photo {current} of {total}',
    previousPhoto: 'Previous photo',
    nextPhoto: 'Next photo',
    expand: 'View photos full screen',
    book: 'Book this room',
    guests: 'guests',
    bathroom: 'bathroom',
    bathrooms: 'bathrooms',
    noPhotos: 'Room photos coming soon',
    amenities: 'Amenities',
  },
};
type Labels = (typeof fallbackLabels)['es'];
const fill = (text: string, current: number, total: number) => text.replace('{current}', String(current)).replace('{total}', String(total));

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** Photos of one room: native horizontal swipe, arrows and thumbnails. */
function Gallery({ images, name, labels, fullscreen = false, start = 0, onExpand, onIndex }: {
  images: string[]; name: string; labels: Labels; fullscreen?: boolean; start?: number; onExpand?: (index: number) => void; onIndex?: (index: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(start);

  useEffect(() => {
    const el = track.current;
    if (el && start > 0) el.scrollLeft = start * el.clientWidth;
  }, [start]);

  const go = useCallback((index: number) => {
    const el = track.current;
    if (!el) return;
    const target = Math.max(0, Math.min(images.length - 1, index));
    el.scrollTo({ left: target * el.clientWidth, behavior: 'smooth' });
  }, [images.length]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(active + 1);
      if (event.key === 'ArrowLeft') go(active - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, go, active]);

  if (!images.length)
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center text-white/50">
        <BedDouble size={44} strokeWidth={1.25} className="opacity-50" />
        <p className="text-sm uppercase tracking-[0.25em] font-medium">{labels.noPhotos}</p>
      </div>
    );

  return (
    <div className="group/gallery absolute inset-0">
      <div
        ref={track}
        onScroll={(event) => {
          const el = event.currentTarget;
          const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (next !== active) { setActive(next); onIndex?.(next); }
        }}
        className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        aria-roledescription="carousel"
        aria-label={name}
      >
        {images.map((src, index) => (
          <div key={src + index} className="relative w-full h-full shrink-0 snap-center" role="group" aria-label={fill(labels.photo, index + 1, images.length)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${name} — ${fill(labels.photo, index + 1, images.length)}`}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
              className={`absolute inset-0 w-full h-full select-none ${fullscreen ? 'object-contain' : 'object-cover'}`}
            />
          </div>
        ))}
      </div>

      {!fullscreen && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent" />}

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(active - 1)}
            disabled={active === 0}
            aria-label={labels.previousPhoto}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center rounded-full bg-black/40 text-white border border-white/20 backdrop-blur-md transition-all duration-300 hover:bg-black/65 disabled:opacity-0 disabled:pointer-events-none lg:opacity-0 lg:group-hover/gallery:opacity-100 focus-visible:opacity-100"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={() => go(active + 1)}
            disabled={active === images.length - 1}
            aria-label={labels.nextPhoto}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center rounded-full bg-black/40 text-white border border-white/20 backdrop-blur-md transition-all duration-300 hover:bg-black/65 disabled:opacity-0 disabled:pointer-events-none lg:opacity-0 lg:group-hover/gallery:opacity-100 focus-visible:opacity-100"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 md:p-5">
        <span className="rounded-full bg-black/45 backdrop-blur-md border border-white/15 px-3 py-1.5 text-xs font-bold tracking-[0.2em] text-white tabular-nums">
          {String(active + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
        </span>

        {/* Phones: dots. Larger screens: thumbnails. */}
        {images.length > 1 && (
          <>
            <div className="flex md:hidden items-center gap-1.5 pb-2" aria-hidden="true">
              {images.map((_, index) => (
                <span key={index} className={`h-1.5 rounded-full transition-all duration-300 ${index === active ? 'w-5 bg-white' : 'w-1.5 bg-white/45'}`} />
              ))}
            </div>
            <div className="hidden md:flex items-center gap-2 overflow-x-auto max-w-[70%] [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
              {images.map((src, index) => (
                <button
                  key={src + index}
                  type="button"
                  onClick={() => go(index)}
                  aria-label={fill(labels.photo, index + 1, images.length)}
                  aria-current={index === active}
                  className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-300 ${index === active ? 'border-white opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </>
        )}

        {onExpand && (
          <button
            type="button"
            onClick={() => onExpand(active)}
            aria-label={labels.expand}
            title={labels.expand}
            className="flex w-10 h-10 shrink-0 items-center justify-center rounded-full bg-black/45 text-white border border-white/15 backdrop-blur-md transition-colors hover:bg-black/70"
          >
            <Maximize2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export const RoomModal = ({ rooms, index, onIndexChange, onClose }: RoomModalProps) => {
  const { openLodgingBooking } = useBooking();
  const dict = useDictionary() as any;
  const isEn = dict?.nav?.rooms === 'Rooms';
  const labels: Labels = { ...(isEn ? fallbackLabels.en : fallbackLabels.es), ...(dict?.suites?.modal ?? {}) };
  const reduceMotion = useReducedMotion();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isPhone = useMediaQuery('(max-width: 767px)');
  const coarse = useMediaQuery('(pointer: coarse)');
  const swipe = !isDesktop || coarse;

  const open = index !== null && index >= 0 && index < rooms.length;
  const room = open ? rooms[index!] : null;
  const total = rooms.length;
  const [direction, setDirection] = useState(1);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useScrollLock(open);

  const move = useCallback((delta: number) => {
    if (index === null || total < 2) return;
    setDirection(delta);
    setLightbox(null);
    onIndexChange((index + delta + total) % total);
  }, [index, total, onIndexChange]);

  // A new room starts at the top of its text (its gallery remounts at photo 1).
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    content.current?.scrollTo({ top: 0 });
  }, [index]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (lightbox !== null) setLightbox(null);
        else onClose();
      }
      if (lightbox !== null) return; // the arrows move through photos there
      if (event.key === 'ArrowRight') move(1);
      if (event.key === 'ArrowLeft') move(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, lightbox, move, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) move(1);
    else if (info.offset.x > 70 || info.velocity.x > 500) move(-1);
  };

  const name = room ? String(room.name).split(' (')[0] : '';
  const description = room ? room.desc || room.description || '' : '';
  const images: string[] = room?.images || [];
  const details = room?.details;
  const bath = details ? (typeof details.bath === 'number' ? `${details.bath} ${details.bath === 1 ? labels.bathroom : labels.bathrooms}` : details.bath) : '';
  const extras: string[] = details?.extra ? String(details.extra).split(' · ').map((item: string) => item.trim()).filter(Boolean) : [];
  const price = room && room.price !== undefined && room.price !== 0
    ? (typeof room.price === 'number' ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(room.price) + (isEn ? ' MXN / night' : ' MXN / noche') : String(room.price))
    : '';
  const book = () => { if (!room?.lodgingId) return; onClose(); openLodgingBooking(room.lodgingId); };

  const slide = reduceMotion ? 0 : 36;
  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * slide }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: -dir * slide }),
  };

  const pagerButton = 'flex items-center justify-center rounded-full border transition-all duration-300 disabled:opacity-30';

  return (
    <AnimatePresence>
      {room && (
        <motion.div
          key="room-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-end md:items-center justify-center md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-modal-title"
        >
          <div className="absolute inset-0 bg-[#0F0D0C]/75 backdrop-blur-md" onClick={onClose} aria-hidden="true" />

          <motion.div
            initial={isPhone ? { y: '8%', opacity: 0 } : { scale: 0.96, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={isPhone ? { y: '8%', opacity: 0 } : { scale: 0.96, y: 16, opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="relative flex flex-col w-full h-[100dvh] bg-[#F9F7F4] text-[#23211F] shadow-2xl overflow-hidden md:h-[min(94dvh,1080px)] md:w-[min(92vw,860px)] md:rounded-[2rem] lg:h-[min(88dvh,820px)] lg:w-[min(94vw,1320px)]"
          >
            <button
              ref={closeButton}
              type="button"
              onClick={onClose}
              aria-label={labels.close}
              className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 md:top-5 md:right-5 z-30 flex w-11 h-11 items-center justify-center rounded-full border bg-black/40 text-white border-white/25 backdrop-blur-md transition-colors hover:bg-black/65 lg:bg-white lg:text-[#23211F] lg:border-[#E5E0D8] lg:hover:bg-[#23211F] lg:hover:text-white lg:backdrop-blur-none"
            >
              <X size={20} />
            </button>

            <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto overscroll-contain lg:overflow-hidden lg:flex">
              {/* Photos */}
              <div className="relative h-[42dvh] min-h-[260px] shrink-0 bg-[#1A1816] md:h-[44dvh] lg:h-full lg:w-[56%]">
                <Gallery key={room.id} images={images} name={name} labels={labels} onExpand={images.length ? setLightbox : undefined} />
              </div>

              {/* Room */}
              <div ref={content} className="lg:w-[44%] lg:h-full lg:overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#E5E0D8]">
                {/* Phones and tablets: room pager with the swipe hint */}
                {total > 1 && (
                  <div className="lg:hidden sticky top-0 z-20 flex items-center justify-between gap-3 bg-[#23211F] px-4 py-3 text-[#F9F7F4] md:px-8">
                    <button type="button" onClick={() => move(-1)} aria-label={labels.previous} className={`${pagerButton} w-10 h-10 border-white/15 hover:bg-white/10`}>
                      <ChevronLeft size={18} />
                    </button>
                    <div className="flex min-w-0 flex-col items-center gap-1.5">
                      <div className="flex items-center gap-1.5" aria-hidden="true">
                        {rooms.map((r, i) => (
                          <span key={r.id ?? i} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-[#9B7E67]' : 'w-1.5 bg-white/30'}`} />
                        ))}
                      </div>
                      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#F9F7F4]/70">
                        <motion.span animate={reduceMotion ? undefined : { x: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }} className="flex text-[#9B7E67]">
                          <MoveHorizontal size={14} />
                        </motion.span>
                        <span className="truncate">{labels.swipeHint}</span>
                      </p>
                    </div>
                    <button type="button" onClick={() => move(1)} aria-label={labels.next} className={`${pagerButton} w-10 h-10 border-white/15 hover:bg-white/10`}>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}

                <AnimatePresence mode="wait" custom={direction} initial={false}>
                  <motion.div
                    key={room.id ?? index}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                    drag={swipe && total > 1 ? 'x' : false}
                    dragDirectionLock
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.16}
                    dragSnapToOrigin
                    onDragEnd={onDragEnd}
                    style={{ touchAction: 'pan-y' }}
                    className="px-6 pt-7 pb-10 md:px-10 md:pt-9 lg:px-12 lg:pt-14 lg:pb-12"
                  >
                    <p className="text-[#9B7E67] text-xs md:text-sm font-bold uppercase tracking-[0.3em]" aria-live="polite">
                      {fill(labels.position, index! + 1, total)}
                    </p>

                    <div className="mt-3 flex items-start justify-between gap-6">
                      <h2 id="room-modal-title" className="font-serif text-4xl md:text-5xl leading-[1.05] text-[#23211F] pr-10 lg:pr-0">{name}</h2>
                      {/* Desktop: arrows next to the room name */}
                      {total > 1 && (
                        <div className="hidden lg:flex shrink-0 flex-col items-end gap-2 pr-14 pt-1">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => move(-1)} aria-label={labels.previous} title={labels.previous} className={`${pagerButton} w-11 h-11 border-[#D9D2C7] text-[#23211F] hover:bg-[#23211F] hover:text-white hover:border-[#23211F]`}>
                              <ChevronLeft size={20} />
                            </button>
                            <button type="button" onClick={() => move(1)} aria-label={labels.next} title={labels.next} className={`${pagerButton} w-11 h-11 border-[#D9D2C7] text-[#23211F] hover:bg-[#23211F] hover:text-white hover:border-[#23211F]`}>
                              <ChevronRight size={20} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {total > 1 && (
                      <p className="hidden lg:block mt-3 text-xs font-bold uppercase tracking-[0.2em] text-[#8A8279]">{labels.arrowsHint}</p>
                    )}

                    <div className="mt-7 md:grid md:grid-cols-[minmax(0,1fr)_minmax(300px,0.95fr)] md:gap-10 lg:block">
                      <div>
                        <p className="text-[#524D48] font-light text-lg md:text-xl leading-relaxed whitespace-pre-line">{description}</p>

                        {details && (
                          <ul className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-1 lg:grid-cols-2">
                            {details.guests ? (
                              <li className="flex items-center gap-3 rounded-2xl border border-[#E5E0D8] bg-white px-4 py-3 text-base text-[#3A3632]">
                                <Users size={18} className="shrink-0 text-[#9B7E67]" />
                                <span>{details.guests} {dict?.modal?.guests?.toLowerCase?.() || labels.guests}</span>
                              </li>
                            ) : null}
                            {details.beds ? (
                              <li className="flex items-center gap-3 rounded-2xl border border-[#E5E0D8] bg-white px-4 py-3 text-base text-[#3A3632]">
                                <BedDouble size={18} className="shrink-0 text-[#9B7E67]" />
                                <span>{details.beds}</span>
                              </li>
                            ) : null}
                            {bath ? (
                              <li className="flex items-center gap-3 rounded-2xl border border-[#E5E0D8] bg-white px-4 py-3 text-base text-[#3A3632]">
                                <Bath size={18} className="shrink-0 text-[#9B7E67]" />
                                <span>{bath}</span>
                              </li>
                            ) : null}
                            {/* Rooms managed in CALA list Wi-Fi among their amenities below. */}
                            {extras.length === 0 && (
                              <li className="flex items-center gap-3 rounded-2xl border border-[#E5E0D8] bg-white px-4 py-3 text-base text-[#3A3632]">
                                <Wifi size={18} className="shrink-0 text-[#9B7E67]" />
                                <span>Wi-Fi</span>
                              </li>
                            )}
                          </ul>
                        )}

                        {extras.length > 0 && (
                          <div className="mt-7">
                            <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-[#8A8279]">{labels.amenities}</h3>
                            <ul className="mt-3 flex flex-wrap gap-2">
                              {extras.map((item) => (
                                <li key={item} className="flex items-center gap-1.5 rounded-full bg-[#EFEAE3] px-3.5 py-1.5 text-sm text-[#3A3632]">
                                  <Check size={14} className="text-[#9B7E67]" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="mt-8 md:mt-0 lg:mt-9 flex flex-col gap-6">
                        {price && (
                          <p className="hidden md:block font-serif italic text-2xl text-[#23211F]">{price}</p>
                        )}
                        {room.lodgingId && (
                          <RoomAvailabilityCalendar key={room.lodgingId} lodgingId={room.lodgingId} isEn={isEn} />
                        )}
                        {room.lodgingId && (
                          <button
                            type="button"
                            onClick={book}
                            className="hidden md:inline-flex w-full items-center justify-center rounded-full bg-[#23211F] px-7 py-4 text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-[#9B7E67] lg:w-auto lg:self-start"
                          >
                            {labels.book}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Phones: booking bar always within reach */}
            {(price || room.lodgingId) && (
              <div className="md:hidden shrink-0 flex items-center justify-between gap-4 border-t border-[#E5E0D8] bg-white px-5 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(35,33,31,0.08)]">
                <p className="min-w-0 font-serif italic text-lg leading-tight text-[#23211F]">{price}</p>
                {room.lodgingId && (
                  <button type="button" onClick={book} className="shrink-0 rounded-full bg-[#23211F] px-6 py-3.5 text-xs font-semibold uppercase tracking-widest text-white active:bg-[#9B7E67]">
                    {labels.book}
                  </button>
                )}
              </div>
            )}
          </motion.div>

          {/* Full-screen photos */}
          <AnimatePresence>
            {lightbox !== null && images.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[120] bg-black"
                role="dialog"
                aria-modal="true"
                aria-label={labels.expand}
              >
                <Gallery images={images} name={name} labels={labels} fullscreen start={lightbox ?? 0} />
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  aria-label={labels.close}
                  autoFocus
                  className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 flex w-11 h-11 items-center justify-center rounded-full bg-white/10 text-white border border-white/20 backdrop-blur-md transition-colors hover:bg-white/25"
                >
                  <X size={22} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

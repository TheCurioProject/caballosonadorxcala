'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ArrowRight, CalendarDays, User, BedDouble } from 'lucide-react';
import { retreatAvailability, retreatDates, retreatNights, retreatPrice, retreatText, type Retreat } from '@/lib/retreats';

const RetreatBookingModal = dynamic(() => import('./RetreatBookingModal').then(m => m.RetreatBookingModal), { ssr: false });

export function RetreatCard({ retreat, lang, onSale, remaining, fromMinor = null }: { retreat: Retreat; lang: 'es' | 'en'; onSale: boolean; remaining: number; /** Cheapest retreat + lodging total among the free rooms. */ fromMinor?: number | null }) {
  const [open, setOpen] = useState(false);
  const [booking, setBooking] = useState(false);
  const isEn = lang === 'en';
  const title = retreatText(retreat.title, lang);
  const summary = retreatText(retreat.summary, lang);
  const description = retreatText(retreat.description, lang);
  const bio = retreatText(retreat.instructorBio, lang);
  const dates = retreatDates(retreat.startsOn, retreat.endsOn, lang);
  const nights = retreatNights(retreat.startsOn, retreat.endsOn);
  const bookable = onSale && remaining > 0 && Boolean(retreat.priceMinor);

  const bookButton = (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); if (bookable) setBooking(true); }}
      disabled={!bookable}
      className="inline-flex items-center justify-center gap-2 bg-[#23211F] hover:bg-[#9B7E67] text-white px-7 py-4 rounded-full text-sm font-bold tracking-widest uppercase transition-all shadow-md hover:shadow-lg disabled:bg-[#2C2927]/20 disabled:text-[#2C2927]/50 disabled:shadow-none"
    >
      {bookable ? (isEn ? 'Book this retreat' : 'Reserva este retiro') : retreatAvailability(0, lang)}
      {bookable && <ArrowRight size={16} />}
    </button>
  );

  return (
    <article className="bg-white rounded-3xl border border-[#2C2927]/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row cursor-pointer" onClick={() => setOpen(o => !o)}>
        {retreat.imageUrl && (
          <div className="w-full md:w-2/5 h-60 md:h-auto md:min-h-[320px] relative overflow-hidden flex-shrink-0">
            <Image src={retreat.imageUrl} alt={title} fill className="object-cover transition-transform duration-700 hover:scale-105" sizes="(max-width: 768px) 100vw, 40vw" />
          </div>
        )}
        <div className={`p-6 sm:p-8 md:p-12 flex flex-col justify-center w-full min-w-0 ${retreat.imageUrl ? 'md:w-3/5' : ''}`}>
          <div className="flex justify-between items-start gap-4">
            <h2 className="font-serif text-3xl md:text-4xl text-[#2C2927] mb-4 break-words min-w-0">{title}</h2>
            <span className="flex-shrink-0 w-10 h-10 rounded-full border border-[#2C2927]/20 flex items-center justify-center text-[#9B7E67] bg-[#F9F7F4]" aria-hidden>
              {open ? <Minus strokeWidth={1} /> : <Plus strokeWidth={1} />}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3 mb-5">
            {dates && (
              <span className="flex items-center gap-2 text-sm text-[#9B7E67] font-medium bg-[#F9F7F4] px-4 py-2 rounded-full border border-[#9B7E67]/20">
                <CalendarDays size={16} /> {dates}{nights > 0 && <span className="text-[#2C2927]/50"> · {nights} {isEn ? (nights === 1 ? 'night' : 'nights') : (nights === 1 ? 'noche' : 'noches')}</span>}
              </span>
            )}
            {retreat.priceMinor ? (
              <span className="flex items-center gap-2 text-sm text-[#9B7E67] font-medium bg-[#F9F7F4] px-4 py-2 rounded-full border border-[#9B7E67]/20">
                <BedDouble size={16} />
                {fromMinor != null
                  ? <>{isEn ? 'From' : 'Desde'} {retreatPrice(fromMinor, lang)} <span className="text-[#2C2927]/50">{isEn ? '· retreat + lodging' : '· retiro + hospedaje'}</span></>
                  : <>{retreatPrice(retreat.priceMinor, lang)} <span className="text-[#2C2927]/50">{isEn ? '· retreat' : '· retiro'}</span></>}
              </span>
            ) : null}
            {onSale && (
              <span className={`flex items-center text-sm font-bold px-4 py-2 rounded-full ${remaining > 0 ? 'bg-[#9B7E67] text-white' : 'bg-[#2C2927]/10 text-[#2C2927]/60'}`}>
                {retreatAvailability(remaining, lang)}
              </span>
            )}
          </div>

          {(summary || description) && (
            <p className="text-[#2C2927]/70 font-light text-lg leading-relaxed line-clamp-3 whitespace-pre-line">{summary || description}</p>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            {!open && (
              <span className="flex items-center gap-2 text-[#9B7E67] text-sm tracking-widest uppercase font-bold">
                {isEn ? 'Read more' : 'Leer más'} <ArrowRight size={16} />
              </span>
            )}
            {onSale && bookButton}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-8 sm:px-8 md:px-12 md:pb-12 border-t border-[#2C2927]/10 pt-8 bg-[#F9F7F4]/50 flex flex-col md:flex-row gap-10 md:gap-12">
              <div className="flex-1 min-w-0">
                {description && <div className="text-[#2C2927]/80 font-light leading-relaxed whitespace-pre-wrap break-words">{description}</div>}
                {onSale && <div className="mt-8">{bookButton}</div>}
              </div>
              {(retreat.instructorName || bio || retreat.instructorImageUrl) && (
                <aside className="w-full md:w-1/3 md:border-l md:border-[#2C2927]/10 md:pl-12 pt-8 md:pt-0 border-t border-[#2C2927]/10 md:border-t-0">
                  <div className="flex items-center gap-3 mb-6">
                    <User className="text-[#9B7E67]" size={20} />
                    <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-[#9B7E67]">Instructor</h3>
                  </div>
                  {retreat.instructorImageUrl && (
                    <div className="relative w-32 h-32 md:w-44 md:h-44 rounded-2xl overflow-hidden mb-6 shadow-md">
                      <Image src={retreat.instructorImageUrl} alt={retreat.instructorName || ''} fill className="object-cover" sizes="176px" />
                    </div>
                  )}
                  {retreat.instructorName && <h4 className="font-serif text-2xl text-[#2C2927] mb-4">{retreat.instructorName}</h4>}
                  {bio && <p className="text-[#2C2927]/70 font-light text-sm leading-relaxed whitespace-pre-wrap">{bio}</p>}
                </aside>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {booking && (
        <RetreatBookingModal
          retreat={{ id: retreat.id, title, startsOn: retreat.startsOn, endsOn: retreat.endsOn, priceMinor: retreat.priceMinor!, imageUrl: retreat.imageUrl }}
          lang={lang}
          onClose={() => setBooking(false)}
        />
      )}
    </article>
  );
}

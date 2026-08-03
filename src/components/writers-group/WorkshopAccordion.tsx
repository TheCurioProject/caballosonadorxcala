'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ArrowRight, Calendar, DollarSign, User, MessageCircle } from 'lucide-react';
import Image from 'next/image';

interface WorkshopProps {
  workshop: {
    id: number;
    titleEs: string;
    titleEn: string;
    summaryEs: string | null;
    summaryEn: string | null;
    descriptionEs: string;
    descriptionEn: string;
    imageUrl: string | null;
    instructorName: string | null;
    instructorBioEs: string | null;
    instructorBioEn: string | null;
    instructorImageUrl: string | null;
    price: string | null;
    datesEs: string | null;
    datesEn: string | null;
  };
  lang: 'es' | 'en';
  whatsappNumber: string;
}

export const WorkshopAccordion = ({ workshop, lang, whatsappNumber }: WorkshopProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const title = lang === 'en' ? workshop.titleEn : workshop.titleEs;
  const summary = lang === 'en' ? workshop.summaryEn : workshop.summaryEs;
  const description = lang === 'en' ? workshop.descriptionEn : workshop.descriptionEs;
  const instructorBio = lang === 'en' ? workshop.instructorBioEn : workshop.instructorBioEs;
  const dates = lang === 'en' ? workshop.datesEn : workshop.datesEs;

  const whatsappMessage = lang === 'en' 
    ? `Hello! I would like more information about the workshop: ${title}`
    : `¡Hola! Me gustaría recibir más información sobre el taller: ${title}`;
    
  const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="bg-white rounded-3xl border border-[#2C2927]/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow relative">
      {/* Decorative Vector */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 0C55.2285 0 100 44.7715 100 100V0H0Z" fill="#9B7E67"/>
        </svg>
      </div>

      <div className="flex flex-col md:flex-row cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        {workshop.imageUrl && (
          <div className="w-full md:w-2/5 h-64 md:h-auto relative overflow-hidden flex-shrink-0">
            <Image
              src={workshop.imageUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-700 hover:scale-105"
              sizes="(max-width: 768px) 100vw, 40vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent md:hidden" />
          </div>
        )}
        
        <div className={`p-8 md:p-12 flex flex-col justify-center w-full relative z-10 ${!workshop.imageUrl ? 'md:w-full' : 'md:w-3/5'}`}>
          <div className="flex justify-between items-start gap-4">
            <h3 className="font-serif text-3xl md:text-4xl text-[#2C2927] mb-4">
              {title}
            </h3>
            <div className="flex-shrink-0 w-10 h-10 rounded-full border border-[#2C2927]/20 flex items-center justify-center text-[#9B7E67] transition-all bg-[#F9F7F4] hover:bg-[#9B7E67] hover:text-white hover:border-transparent">
              {isOpen ? <Minus strokeWidth={1} /> : <Plus strokeWidth={1} />}
            </div>
          </div>
          
          {(dates || workshop.price) && (
            <div className="flex flex-wrap gap-4 mb-6">
              {dates && (
                <div className="flex items-center gap-2 text-sm text-[#9B7E67] font-medium tracking-wide bg-[#F9F7F4] px-4 py-2 rounded-full border border-[#9B7E67]/20">
                  <Calendar size={16} />
                  <span>{dates}</span>
                </div>
              )}
              {workshop.price && (
                <div className="flex items-center gap-2 text-sm text-[#9B7E67] font-medium tracking-wide bg-[#F9F7F4] px-4 py-2 rounded-full border border-[#9B7E67]/20">
                  <DollarSign size={16} />
                  <span>{workshop.price}</span>
                </div>
              )}
            </div>
          )}

          {(summary || description) && (
            <p className="text-[#2C2927]/70 font-light text-lg leading-relaxed line-clamp-3">
              {summary || description.substring(0, 150) + '...'}
            </p>
          )}

          {!isOpen && (
            <div className="mt-8 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#9B7E67] text-sm tracking-widest uppercase font-bold group">
                <span className="group-hover:mr-1 transition-all">{lang === 'en' ? 'Read More' : 'Leer Más'}</span>
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
            className="overflow-hidden"
          >
            <div className="px-8 pb-8 md:px-12 md:pb-12 border-t border-[#2C2927]/10 pt-8 mt-2 bg-[#F9F7F4]/50 flex flex-col md:flex-row gap-12">
              
              <div className="flex-1">
                <h4 className="text-xs uppercase tracking-[0.2em] font-bold text-[#9B7E67] mb-6">
                  {lang === 'en' ? 'About the Workshop' : 'Acerca del Taller'}
                </h4>
                <div 
                  className="prose prose-stone max-w-none text-[#2C2927]/80 font-light leading-relaxed whitespace-pre-wrap"
                >
                  {description}
                </div>
                
                <div className="mt-10">
                  <a 
                    href={whatsappUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#D4A373] hover:bg-[#C39362] text-white px-8 py-4 rounded-full text-sm font-bold tracking-widest uppercase transition-all shadow-md hover:shadow-lg transform hover:-translate-y-1"
                  >
                    <MessageCircle size={20} />
                    <span>{lang === 'en' ? 'Contact via WhatsApp' : 'Contactar por WhatsApp'}</span>
                  </a>
                </div>
              </div>

              {/* Instructor Information Sidebar */}
              {(workshop.instructorName || instructorBio || workshop.instructorImageUrl) && (
                <div className="w-full md:w-1/3 md:border-l md:border-[#2C2927]/10 md:pl-12 pt-8 md:pt-0 border-t border-[#2C2927]/10 md:border-t-0">
                  <div className="sticky top-8">
                    <div className="flex items-center gap-3 mb-6">
                      <User className="text-[#9B7E67]" size={20} />
                      <h4 className="text-xs uppercase tracking-[0.2em] font-bold text-[#9B7E67]">
                        {lang === 'en' ? 'Instructor' : 'Instructor'}
                      </h4>
                    </div>

                    {workshop.instructorImageUrl && (
                      <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-2xl overflow-hidden mb-6 shadow-md">
                        <Image 
                          src={workshop.instructorImageUrl} 
                          alt={workshop.instructorName || 'Instructor'} 
                          fill 
                          className="object-cover"
                        />
                      </div>
                    )}
                    
                    {workshop.instructorName && (
                      <h5 className="font-serif text-2xl text-[#2C2927] mb-4">
                        {workshop.instructorName}
                      </h5>
                    )}

                    {instructorBio && (
                      <p className="text-[#2C2927]/70 font-light text-sm leading-relaxed whitespace-pre-wrap">
                        {instructorBio}
                      </p>
                    )}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

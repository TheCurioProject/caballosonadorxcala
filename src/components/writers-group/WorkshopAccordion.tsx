'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ArrowRight } from 'lucide-react';
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
  };
  lang: 'es' | 'en';
}

export const WorkshopAccordion = ({ workshop, lang }: WorkshopProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const title = lang === 'en' ? workshop.titleEn : workshop.titleEs;
  const summary = lang === 'en' ? workshop.summaryEn : workshop.summaryEs;
  const description = lang === 'en' ? workshop.descriptionEn : workshop.descriptionEs;

  return (
    <div className="bg-white rounded-3xl border border-[#2C2927]/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
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
          </div>
        )}
        
        <div className={`p-8 md:p-12 flex flex-col justify-center w-full ${!workshop.imageUrl ? 'md:w-full' : 'md:w-3/5'}`}>
          <div className="flex justify-between items-start gap-4">
            <h3 className="font-serif text-3xl md:text-4xl text-[#2C2927] mb-4">
              {title}
            </h3>
            <div className="flex-shrink-0 w-10 h-10 rounded-full border border-[#2C2927]/20 flex items-center justify-center text-[#9B7E67] transition-all bg-[#F9F7F4]">
              {isOpen ? <Minus strokeWidth={1} /> : <Plus strokeWidth={1} />}
            </div>
          </div>
          
          {(summary || description) && (
            <p className="text-[#2C2927]/70 font-light text-lg leading-relaxed line-clamp-3">
              {summary || description.substring(0, 150) + '...'}
            </p>
          )}

          {!isOpen && (
            <div className="mt-6 flex items-center gap-2 text-[#9B7E67] text-sm tracking-widest uppercase font-bold">
              {lang === 'en' ? 'Read More' : 'Leer Más'} <ArrowRight size={16} />
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
            <div className="px-8 pb-8 md:px-12 md:pb-12 border-t border-[#2C2927]/10 pt-8 mt-2 bg-[#F9F7F4]/50">
              <div 
                className="prose prose-stone max-w-none text-[#2C2927]/80 font-light leading-relaxed whitespace-pre-wrap"
              >
                {description}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import Image from 'next/image';

interface WorkshopProps {
  workshop: {
    id: number;
    title: string;
    description: string;
    imageUrl: string | null;
  };
}

export const WorkshopAccordion = ({ workshop }: WorkshopProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-[#2C2927]/20 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 md:py-8 flex justify-between items-center group text-left transition-colors"
      >
        <h3 className="font-serif text-2xl md:text-4xl text-[#2C2927] group-hover:text-[#9B7E67] transition-colors pr-4">
          {workshop.title}
        </h3>
        <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full border border-[#2C2927]/20 flex items-center justify-center group-hover:border-[#9B7E67] group-hover:text-[#9B7E67] transition-all">
          {isOpen ? <Minus strokeWidth={1} /> : <Plus strokeWidth={1} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-8 md:pb-12 pt-2">
              <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-stretch">
                {/* Image Section */}
                {workshop.imageUrl && (
                  <div className="w-full md:w-1/2 flex-shrink-0">
                    <div className="relative w-full aspect-[4/3] md:aspect-square overflow-hidden rounded-lg shadow-lg">
                      <Image
                        src={workshop.imageUrl}
                        alt={workshop.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>
                  </div>
                )}

                {/* Text Section with Internal Scroll */}
                <div className={`w-full ${workshop.imageUrl ? 'md:w-1/2' : ''} flex flex-col`}>
                  <div className="bg-[#F9F7F4]/50 p-6 md:p-8 rounded-lg flex-grow border border-[#2C2927]/5 h-full">
                    <div 
                      className="prose prose-stone max-w-none text-[#2C2927]/80 font-light leading-relaxed md:max-h-[500px] md:overflow-y-auto custom-scrollbar pr-2 whitespace-pre-wrap"
                      style={{ scrollbarWidth: 'thin', scrollbarColor: '#9B7E67 transparent' }}
                    >
                      {workshop.description}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

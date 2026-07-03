'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { RevealText } from './RevealText';
import { useDictionary } from '@/i18n/DictionaryContext';

export const Experiences = ({ experiences }: { experiences: any[] }) => {
  const dict = useDictionary();
  return (
    <section id="experiencias" className="relative bg-[#23211F]">
      
      {/* Intro to experiences - Sticky */}
      <div className="h-[100dvh] flex items-center justify-center text-center px-6 sticky top-0 bg-[#23211F] text-white">
        <div className="max-w-3xl mix-blend-difference">
          <RevealText>
            <h2 className="uppercase tracking-[0.3em] text-xs font-bold mb-4">{dict.tours.subtitle}</h2>
          </RevealText>
          <RevealText delay={0.1}>
            <h3 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-tight">{dict.tours.title}</h3>
          </RevealText>
          <RevealText delay={0.3}>
             <p className="mt-12 text-xs md:text-sm font-bold uppercase tracking-[0.3em] animate-pulse">{dict.tours.scroll}</p>
          </RevealText>
        </div>
      </div>

      {/* Full-screen Stacking Cards */}
      {experiences.map((exp, i) => (
        <div key={i} className="sticky top-0 h-[100dvh] w-full overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 z-10" />
          <motion.img 
            initial={{ scale: 1.1 }}
            whileInView={{ scale: 1 }}
            transition={{ duration: 1.5 }}
            src={exp.imageUrl || `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/tour_03_catamaran_0546.jpg`} 
            alt={exp.title} 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="relative z-20 text-center text-white drop-shadow-xl px-6 max-w-4xl flex flex-col items-center">
            <h4 className="font-serif text-4xl sm:text-6xl md:text-8xl mb-6 drop-shadow-2xl">{exp.title}</h4>
            <p className="font-light text-lg md:text-2xl mb-10 max-w-2xl text-[#F9F7F4] drop-shadow-lg">{exp.description}</p>
            {exp.price && <span className="border border-white text-white px-6 py-3 text-xs uppercase tracking-widest rounded-full bg-black/20 backdrop-blur-sm hover:bg-white hover:text-black transition-colors cursor-pointer">{exp.price}</span>}
          </div>
        </div>
      ))}
      
      {/* Spacer to allow the final sticky image to hold briefly before the footer covers it */}
      <div className="h-[20vh] bg-transparent relative z-10"></div>
    </section>
  );
};

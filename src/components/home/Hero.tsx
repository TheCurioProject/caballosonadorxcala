'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import { RevealText } from './RevealText';
import { useDictionary } from '@/i18n/DictionaryContext';

export const Hero = ({ imageSrc }: { imageSrc?: string }) => {
  const dict = useDictionary();
  const isSpanish = dict.hero.breathe === 'Respira';
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  // Parallax enhanced: translate Y and Scale for depth
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const willChange = useTransform(scrollYProgress, (v) => (v > 0 && v < 1 ? "transform" : "auto"));

  return (
    <section ref={ref} className="relative min-h-[100dvh] w-full overflow-hidden bg-[#1A1817]">
      <motion.div style={{ y, scale, opacity, willChange }} className="absolute inset-0 w-full h-full transform-gpu origin-top">
        <Image 
          src={imageSrc || `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/casaexterior.webp`}
          alt="Casa Caballo Soñador - Hotel Boutique en Chacala, Nayarit" 
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-70"
          fetchPriority="high"
        />
        {/* Refined gradient overlay for high contrast and elegant moody feel */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1817] via-[#1A1817]/40 to-transparent"></div>
        <div className="absolute inset-0 bg-black/10"></div>
      </motion.div>
      
      <div className="relative z-10 min-h-[100dvh] flex flex-col pt-32 pb-24 md:pb-32 px-6 md:px-16 text-white w-full max-w-7xl mx-auto drop-shadow-2xl">
        <RevealText delay={0.2} className="mb-6 md:mb-8 max-w-5xl mt-auto md:translate-y-16">
          <h1 className="flex flex-col gap-3 md:gap-2">
            <span className="uppercase tracking-[0.2em] md:tracking-[0.4em] text-sm md:text-base md:text-sm font-bold text-[#D5C6B1]">
              {dict.hero.title}
            </span>
            <span className="font-serif italic font-light leading-[0.85] tracking-tighter block break-words text-[clamp(4.5rem,min(15vw,22vh),14rem)] md:grid md:w-max md:self-start md:grid-cols-1 md:justify-items-start md:text-[clamp(4.25rem,min(14vw,20vh),13rem)]">
              <span className="block md:w-full md:text-left">{dict.hero.breathe}</span>
              <span className={`block italic font-light text-[#F9F7F4] ${isSpanish ? 'md:w-full md:text-left' : 'md:justify-self-center md:-translate-x-[0.1em]'}`}>{dict.hero.belong}</span>
              <span className={`block md:w-full md:text-left ${isSpanish ? 'md:-translate-x-[0.04em]' : 'md:-translate-x-[0.08em]'}`}>{dict.hero.become}</span>
            </span>
          </h1>
        </RevealText>
      </div>
      
      {/* Redesigned scroll indicator */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 right-6 md:right-16 z-10 text-white flex flex-col items-center gap-4"
      >
        <span className="uppercase tracking-[0.3em] text-[0.65rem] font-medium text-[#D5C6B1]/70">{dict.hero.discover}</span>
        <div className="w-[1px] h-16 md:h-24 bg-white/10 overflow-hidden relative">
          <motion.div 
            animate={{ y: ["-100%", "200%"] }} 
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-full h-1/2 bg-[#D5C6B1]" 
          />
        </div>
      </motion.div>
    </section>
  );
};

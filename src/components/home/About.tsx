'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import Image from 'next/image';
import { RevealText } from './RevealText';
import { useDictionary } from '@/i18n/DictionaryContext';

export const About = ({ imageSrc }: { imageSrc?: string }) => {
  const dict = useDictionary();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  
  const yImage1Transform = useTransform(scrollYProgress, [0, 1], ["-10%", "20%"]);
  const yImage2Transform = useTransform(scrollYProgress, [0, 1], ["20%", "-20%"]);
  const yImage1 = useSpring(yImage1Transform, { stiffness: 400, damping: 90 });
  const yImage2 = useSpring(yImage2Transform, { stiffness: 400, damping: 90 });

  return (
    <section id="nuestra-historia" ref={ref} className="py-16 md:py-32 px-6 md:px-16 bg-[#F9F7F4] text-[#23211F] relative overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-8">
          <RevealText>
            <h2 className="text-[#9B7E67] uppercase tracking-[0.3em] text-xs font-bold">{dict.about.subtitle}</h2>
          </RevealText>
          <RevealText delay={0.1}>
            <h3 className="font-serif text-4xl md:text-6xl leading-tight">{dict.about.title}</h3>
          </RevealText>
          <RevealText delay={0.2}>
            <p className="text-lg font-light leading-relaxed opacity-80 text-[#524D48]">
              {dict.about.p1}
            </p>
          </RevealText>

        </div>

        {/* Animated Single Image */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8 }}
          className="relative h-[400px] md:h-[600px] w-full mt-12 md:mt-0 rounded-2xl overflow-hidden shadow-2xl group"
        >
          <Image 
            src={imageSrc || `/casaestancia.webp`} 
            alt="Casa Caballo Soñador - Exterior" 
            fill 
            sizes="(max-width: 1024px) 100vw, 50vw" 
            className="object-cover transition-transform duration-1000 group-hover:scale-105" 
          />
          <div className="absolute inset-0 border border-black/10 rounded-2xl pointer-events-none group-hover:border-[#9B7E67]/30 transition-colors duration-500"></div>
        </motion.div>
      </div>
    </section>
  );
};

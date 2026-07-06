'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { Leaf, Wind, Droplets } from 'lucide-react';
import { useDictionary } from '@/i18n/DictionaryContext';
import { RevealText } from './RevealText';

export const Concept = () => {
  const dict = useDictionary();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const iconVariants: any = {
    rest: { scale: 1, rotate: 0 },
    hover: { scale: 1.1, rotate: 5, color: "#9B7E67", transition: { type: "spring", stiffness: 300 } }
  };

  return (
    <section id="concepto" className="py-20 md:py-32 px-6 md:px-16 bg-[#F9F7F4] text-[#23211F] relative overflow-hidden border-t border-[#E5E0D8]">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 lg:gap-24 items-center">
        
        {/* Text Section */}
        <motion.div 
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="w-full lg:w-1/2 space-y-10"
        >
          <RevealText>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight mb-8">
              {(dict as any).concept.title}
            </h2>
          </RevealText>
          
          <motion.div variants={itemVariants} className="flex gap-6 group cursor-pointer">
            <motion.div 
              variants={iconVariants} 
              initial="rest" 
              whileHover="hover" 
              className="mt-1 text-[#524D48]"
            >
              <Wind size={28} strokeWidth={1.5} />
            </motion.div>
            <p className="text-[#524D48] font-light text-lg leading-relaxed group-hover:text-[#23211F] transition-colors duration-300">
              {(dict as any).concept.p1}
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="flex gap-6 group cursor-pointer">
            <motion.div 
              variants={iconVariants} 
              initial="rest" 
              whileHover="hover" 
              className="mt-1 text-[#524D48]"
            >
              <Leaf size={28} strokeWidth={1.5} />
            </motion.div>
            <p className="text-[#524D48] font-light text-lg leading-relaxed group-hover:text-[#23211F] transition-colors duration-300">
              {(dict as any).concept.p2}
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="flex gap-6 group cursor-pointer">
            <motion.div 
              variants={iconVariants} 
              initial="rest" 
              whileHover="hover" 
              className="mt-1 text-[#524D48]"
            >
              <Droplets size={28} strokeWidth={1.5} />
            </motion.div>
            <p className="text-[#524D48] font-light text-lg leading-relaxed group-hover:text-[#23211F] transition-colors duration-300">
              {(dict as any).concept.p3}
            </p>
          </motion.div>

        </motion.div>

        {/* Image Section */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="w-full lg:w-1/2 h-[500px] md:h-[700px] relative rounded-2xl overflow-hidden shadow-2xl group"
        >
          <img
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/casaexterior.webp`}
            alt="Concepto Hotel Soñador"
            className="w-full h-full object-cover transition-transform duration-[2s] ease-out group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 pointer-events-none border border-black/10 rounded-2xl group-hover:border-[#9B7E67]/50 transition-colors duration-500 z-20"></div>
        </motion.div>

      </div>
    </section>
  );
};

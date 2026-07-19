'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { Leaf, Wind, Droplets } from 'lucide-react';
import Image from 'next/image';
import { useDictionary } from '@/i18n/DictionaryContext';
import { RevealText } from './RevealText';

export const Concept = ({ imageSrc }: { imageSrc?: string }) => {
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
      <div className="max-w-7xl mx-auto flex flex-col gap-16 lg:gap-20">
        
        {/* Title Section */}
        <div className="text-center max-w-4xl mx-auto">
          <RevealText>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-tight text-[#23211F]">
              {(dict as any).concept.title}
            </h2>
          </RevealText>
        </div>

        {/* Editorial style compact image without frame */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="w-full max-w-xl lg:max-w-2xl mx-auto relative rounded-2xl overflow-hidden shadow-lg group"
          style={{ aspectRatio: '16/9' }}
        >
          <Image
            src={imageSrc || `/imagenes/02_hero/hero_01_img_4885.webp`}
            alt="Concepto Hotel Soñador"
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover transition-transform duration-[2s] ease-out group-hover:scale-105"
          />
          {/* subtle overlay */}
          <div className="absolute inset-0 bg-[#23211F]/5 mix-blend-multiply group-hover:bg-transparent transition-colors duration-1000 z-10 pointer-events-none"></div>
        </motion.div>

        {/* Text Section (3 columns) */}
        <motion.div 
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16 mt-4"
        >
          {/* Feature 1 */}
          <motion.div variants={itemVariants} className="flex flex-col gap-6 group cursor-pointer items-center text-center">
            <motion.div 
              variants={iconVariants} 
              initial="rest" 
              whileHover="hover" 
              className="text-[#9B7E67] bg-[#F0EBE1] p-5 rounded-full shadow-sm"
            >
              <Wind size={32} strokeWidth={1.5} />
            </motion.div>
            <p className="text-[#524D48] font-light text-lg leading-relaxed group-hover:text-[#23211F] transition-colors duration-300">
              {(dict as any).concept.p1}
            </p>
          </motion.div>

          {/* Feature 2 */}
          <motion.div variants={itemVariants} className="flex flex-col gap-6 group cursor-pointer items-center text-center">
            <motion.div 
              variants={iconVariants} 
              initial="rest" 
              whileHover="hover" 
              className="text-[#9B7E67] bg-[#F0EBE1] p-5 rounded-full shadow-sm"
            >
              <Leaf size={32} strokeWidth={1.5} />
            </motion.div>
            <p className="text-[#524D48] font-light text-lg leading-relaxed group-hover:text-[#23211F] transition-colors duration-300">
              {(dict as any).concept.p2}
            </p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div variants={itemVariants} className="flex flex-col gap-6 group cursor-pointer items-center text-center">
            <motion.div 
              variants={iconVariants} 
              initial="rest" 
              whileHover="hover" 
              className="text-[#9B7E67] bg-[#F0EBE1] p-5 rounded-full shadow-sm"
            >
              <Droplets size={32} strokeWidth={1.5} />
            </motion.div>
            <p className="text-[#524D48] font-light text-lg leading-relaxed group-hover:text-[#23211F] transition-colors duration-300">
              {(dict as any).concept.p3}
            </p>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
};

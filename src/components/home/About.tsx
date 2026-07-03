'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { RevealText } from './RevealText';

export const About = () => {
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
            <h2 className="text-[#9B7E67] uppercase tracking-[0.3em] text-xs font-bold">El Santuario</h2>
          </RevealText>
          <RevealText delay={0.1}>
            <h3 className="font-serif text-4xl md:text-6xl leading-tight">La vida se mueve más lento, y la naturaleza marca el ritmo.</h3>
          </RevealText>
          <RevealText delay={0.2}>
            <p className="text-lg font-light leading-relaxed opacity-80 text-[#524D48]">
              Bienvenido a Casa del Caballo Soñador, un bed & breakfast boutique en un pequeño pueblo pesquero. Elaborado con cuidado usando piedra local, madera cálida y suaves linos naturales, cada una de nuestras seis habitaciones refleja la fuerza tranquila de la tierra.
            </p>
          </RevealText>

        </div>

        {/* Desktop Animated Images */}
        <div className="relative h-[600px] w-full hidden md:block">
          <motion.div style={{ y: yImage1 }} className="absolute top-0 right-0 w-[70%] h-[80%] z-10">
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/04_about/DSC_0300.JPG`} alt="El Santuario - Vista principal" className="w-full h-full object-cover shadow-2xl rounded-2xl" />
          </motion.div>
          <motion.div style={{ y: yImage2 }} className="absolute bottom-0 left-0 w-[50%] h-[60%] z-20">
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/04_about/DSC_0307.JPG`} alt="El Santuario - Detalles" className="w-full h-full object-cover shadow-xl border-8 border-[#F9F7F4] rounded-2xl" />
          </motion.div>
        </div>

        {/* Mobile Image */}
        <div className="relative h-[400px] w-full mt-12 block md:hidden">
          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/04_about/DSC_0300.JPG`} alt="El Santuario - Vista principal" className="w-full h-full object-cover shadow-2xl rounded-2xl" />
        </div>
      </div>
    </section>
  );
};

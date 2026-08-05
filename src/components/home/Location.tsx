'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation } from 'lucide-react';
import { useDictionary } from '@/i18n/DictionaryContext';
import dynamic from 'next/dynamic';

// Lazy load the 176KB SVG map — only needed when section is visible
const MexicoMap = dynamic(
  () => import('@/components/ui/MexicoMap').then(mod => mod.MexicoMap),
  { ssr: false }
);

export const Location = () => {
  const dict = useDictionary();
  const loc = (dict as any)?.location;

  return (
    <section id="location" className="py-24 md:py-32 bg-[#FAF9F6] text-[#1A1816] relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-16">
        
        {/* Premium Editorial Header */}
        <div className="text-center mb-20 md:mb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span className="uppercase tracking-[0.4em] text-[#9B7E67] text-sm md:text-base font-bold block mb-6 flex items-center justify-center gap-3">
              <MapPin size={16} /> {loc?.subtitle || 'Ubicación'}
            </span>
            <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl mb-8 leading-none text-[#2C2927]">
              {loc?.title?.split(' ').map((word: string, i: number) => (
                <React.Fragment key={i}>
                  {word}
                  {i === 0 && <br />}
                </React.Fragment>
              )) || (
                <>Descubre<br />Chacala</>
              )}
            </h2>
            <div className="w-px h-24 bg-[#9B7E67]/30 mx-auto mt-8"></div>
          </motion.div>
        </div>

        {/* Editorial Layout: Map + Description */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-center mb-32">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="lg:col-span-5 order-2 lg:order-1 relative"
          >
            <div className="absolute -left-8 -top-8 w-24 h-24 border-t border-l border-[#9B7E67]/20 hidden md:block"></div>
            <p className="font-light text-xl md:text-2xl text-[#2C2927]/80 leading-relaxed mb-10 italic font-serif">
              {loc?.intro2 || 'El nombre del pueblo, que significa "donde hay camarones" en náhuatl, refleja su conexión con la cultura local y la abundante vida marina, añadiendo al carácter distintivo de esta joya costera.'}
            </p>
            <p className="font-light text-lg md:text-xl text-[#2C2927]/60 leading-relaxed">
              {loc?.intro1 || 'Escondida en una pequeña cala a lo largo de la costa del Pacífico en el estado de Nayarit, Chacala destaca por su encanto único y belleza prístina. Al proporcionar una escapada serena, el pueblo cuenta con playas sin aglomeraciones y un ambiente acogedor.'}
            </p>
          </motion.div>

          <div className="lg:col-span-7 order-1 lg:order-2 flex items-center justify-center relative w-full aspect-square lg:aspect-[4/3] bg-white rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] p-8 md:p-16 border border-[#2C2927]/5">
            <MexicoMap className="w-full h-full object-contain drop-shadow-xl" />
            <div className="absolute bottom-8 right-8 text-[#9B7E67] font-serif italic text-xl md:text-2xl opacity-50">{loc?.riviera || 'Riviera Nayarit'}</div>
          </div>
        </div>

        {/* Google Maps Iframe Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="relative max-w-5xl mx-auto"
        >
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 px-4">
            <h3 className="font-serif text-3xl md:text-4xl text-[#2C2927] mb-6 md:mb-0">
              Casa Caballo Soñador
            </h3>
            <a 
              href="https://maps.app.goo.gl/DLkrnoaMf2p9TynEA" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 border border-[#9B7E67] text-[#9B7E67] hover:bg-[#9B7E67] hover:text-[#FAF9F6] rounded-full px-8 py-4 uppercase tracking-[0.2em] text-[10px] md:text-xs font-bold transition-all duration-500"
            >
              <Navigation size={14} /> {loc?.findUs || 'Encuentranos'}
            </a>
          </div>

          <div className="relative h-[400px] md:h-[500px] w-full rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-2xl group border-4 border-white">
            <div className="absolute inset-0 bg-[#2C2927]/10 group-hover:bg-transparent transition-colors duration-700 pointer-events-none z-10"></div>
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3720.6292983230583!2d-105.22340752327881!3d21.167145947292504!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8420d9a4bca0f861%3A0x3405ce44ac8fb3a7!2sCasa%20del%20Caballo%20Sonador!5e0!3m2!1ses!2smx!4v1783360653968!5m2!1ses!2smx" 
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen={true} 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              title="Mapa de ubicación de Casa Caballo Soñador en Chacala, Nayarit"
              className="absolute inset-0 w-full h-full object-cover scale-[1.02] group-hover:scale-100 transition-transform duration-1000"
            ></iframe>
          </div>
        </motion.div>

      </div>
    </section>
  );
};

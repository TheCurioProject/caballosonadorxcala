'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation } from 'lucide-react';

export const Location = () => {
  return (
    <section id="location" className="py-16 md:py-24 bg-[#0A0908] text-[#F9F7F4] relative">
      <div className="max-w-[1400px] mx-auto px-6 md:px-16">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="space-y-8"
          >
            <div>
              <span className="uppercase tracking-[0.3em] text-[#9b6e2f] text-sm font-bold block mb-4 flex items-center gap-2">
                <MapPin size={18} /> Nuestra Ubicación
              </span>
              <h2 className="font-serif text-4xl md:text-7xl mb-6">
                Encuentra tu<br />Paraíso
              </h2>
              <p className="text-gray-300 text-lg font-light leading-relaxed max-w-md">
                Casa del Caballo Soñador está ubicada en el corazón de Chacala, a tan solo minutos caminando de las prístinas playas y rodeada de la vibrante selva de Nayarit.
              </p>
            </div>
            
            <div className="pt-4">
              <a 
                href="https://maps.app.goo.gl/DLkrnoaMf2p9TynEA" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 border border-[#9b6e2f] text-[#9b6e2f] hover:bg-[#9b6e2f] hover:text-[#0A0908] rounded-full px-8 py-4 uppercase tracking-[0.2em] text-xs font-bold transition-all duration-300"
              >
                <Navigation size={16} /> Abrir en Google Maps
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="relative h-[400px] lg:h-[600px] w-full rounded-2xl overflow-hidden shadow-2xl group cursor-pointer"
            onClick={() => window.open('https://maps.app.goo.gl/DLkrnoaMf2p9TynEA', '_blank')}
          >
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14878.530353164479!2d-105.2311822!3d21.1669466!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8420b99de079f2bf%3A0xc6eb9d4a6f950672!2sChacala%2C%20Nay.!5e0!3m2!1sen!2smx!4v1700000000000!5m2!1sen!2smx" 
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen={true} 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700"
            ></iframe>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

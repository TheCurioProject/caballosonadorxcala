'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BedDouble, Waves, 
  Utensils, Wifi, Sun, MoonStar 
} from 'lucide-react';
import { useDictionary } from '@/i18n/DictionaryContext';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
export type { ServiceItem } from './ServiceModal';

const ServiceModal = dynamic(() => import('./ServiceModal').then(mod => mod.ServiceModal), { ssr: false });

const images = [
  '/imagenes/03_rooms/madera_viva.webp', // Rooms
  '/DSC_0226.webp', // Chef
  '/imagenes/05_amenities/amenity_02_pool_lounge_new.webp', // Pool
  '/imagenes/05_amenities/amenity_05_guest_kitchen.webp', // Guest Kitchen
  '/imagenes/05_amenities/amenity_06_wifi.webp', // Wifi
  '/tours_gallery/07_volcano/00_sunset_019.webp', // Sunset
  '/imagenes/05_amenities/amenity_09_rooftop_terrace.webp' // Rooftop
];

const icons = [
  BedDouble, Utensils, Waves, 
  Utensils, Wifi, Sun, MoonStar
];

export const Services = () => {
  const dict = useDictionary();
  const router = useRouter();
  const params = useParams();
  const lang = params?.lang || 'en';
  const [selectedService, setSelectedService] = useState<any | null>(null);

  const servicesData = (dict as any).services.items;

  // Build the full service items
  const serviceItems: any[] = servicesData
    .map((item: any, index: number) => ({
      id: `service-${index}`,
      title: item.title,
      short: item.short,
      desc: item.desc,
      image: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${images[index]}`,
      icon: icons[index],
      originalIndex: index
    }))
    .filter((item: any) => item.originalIndex !== 1);

  return (
    <>
      <section className="py-20 md:py-32 bg-[#23211F] text-[#F9F7F4] relative overflow-hidden border-t border-white/10">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-12 lg:px-16 mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-[#9B7E67] uppercase tracking-[0.3em] text-xs font-bold mb-3">
              {(dict as any).services.subtitle}
            </h2>
            <h3 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-tight">
              {(dict as any).services.title}
            </h3>
          </motion.div>

          <div className="mt-12 md:mt-16 flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
            
            {/* Left side: Image */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7 }}
              className="w-full lg:w-5/12 h-[300px] sm:h-[400px] lg:h-[550px] relative rounded-[2rem] overflow-hidden shadow-2xl flex-shrink-0 lg:sticky lg:top-32"
            >
              <Image 
                src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}${images[0]}`}
                alt="6 Habitaciones Privadas"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent"></div>
            </motion.div>

            {/* Right side: List of amenities */}
            <div className="w-full lg:w-7/12 flex flex-col gap-3 sm:gap-4">
              {serviceItems.map((service, index) => {
                const Icon = service.icon;
                
                return (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <button
                      onClick={() => {
                        setSelectedService(service);
                      }}
                      className="group w-full text-left flex items-start sm:items-center gap-4 sm:gap-6 p-4 sm:p-5 rounded-2xl bg-white/[0.03] hover:bg-[#9B7E67]/20 border border-white/10 hover:border-[#9B7E67]/50 transition-all duration-300 relative overflow-hidden active:scale-[0.98]"
                    >
                      {/* Icon container */}
                      <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#1A1816] border border-white/10 flex items-center justify-center text-[#9B7E67] group-hover:bg-[#9B7E67] group-hover:text-white group-hover:border-[#9B7E67] transition-all duration-300 shadow-sm">
                        <Icon size={24} strokeWidth={1.5} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-6 sm:pr-8">
                        <h4 className="font-serif text-lg sm:text-xl md:text-2xl text-[#F9F7F4] group-hover:text-[#9B7E67] transition-colors duration-300 mb-1">
                          {service.title}
                        </h4>
                        <p className="text-[#F9F7F4]/70 text-xs sm:text-sm md:text-base line-clamp-2 group-hover:text-[#F9F7F4]/90 transition-colors duration-300 leading-relaxed">
                          {service.short}
                        </p>
                      </div>

                      {/* Arrow indicator */}
                      <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-[#9B7E67]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </button>
                  </motion.div>
                );
              })}
            </div>

          </div>
        </div>
      </section>

      {/* Modal */}
      <ServiceModal service={selectedService} onClose={() => setSelectedService(null)} />
    </>
  );
};

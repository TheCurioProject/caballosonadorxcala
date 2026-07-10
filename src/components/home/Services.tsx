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
  '/imagenes/05_amenities/amenity_02_pool_lounge.webp', // Chef
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
  const serviceItems: any[] = servicesData.map((item: any, index: number) => ({
    id: `service-${index}`,
    title: item.title,
    short: item.short,
    desc: item.desc,
    image: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${images[index]}`,
    icon: icons[index]
  }));

  const getBentoClasses = (index: number) => {
    switch (index) {
      case 0:
        return "md:col-span-2 lg:col-span-2 h-[400px] md:h-[450px]";
      case 1:
        return "md:col-span-1 lg:col-span-1 h-[400px] md:h-[450px]";
      case 2:
      case 3:
      case 4:
        return "md:col-span-1 lg:col-span-1 h-[400px]";
      case 5:
        return "md:col-span-1 lg:col-span-2 h-[400px] md:h-[500px]";
      case 6:
        return "md:col-span-1 lg:col-span-1 h-[400px] md:h-[500px]";
      default:
        return "col-span-1 h-[400px]";
    }
  };

  return (
    <>
      <section className="py-20 md:py-32 bg-[#2C2621] text-[#E5E0D8] relative overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-12 lg:px-16 mb-12">
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
            <div className="mt-4 flex items-center gap-2 text-[#9B7E67]/70 text-xs font-bold tracking-[0.2em] uppercase">
              <span className="block opacity-80 animate-pulse">{(dict as any).services.explore}</span>
            </div>
          </motion.div>
        </div>

        {/* Services Layout (Slider on Mobile, Grid on Tablet/Desktop) */}
        <div className="w-full relative">
          <div className="flex items-stretch md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 overflow-x-auto snap-x snap-mandatory touch-pan-x md:overflow-visible md:snap-none md:max-w-[1400px] md:mx-auto px-4 sm:px-6 md:px-12 lg:px-16 pb-8 md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            
            {/* Spacer for proper left alignment on scroll in mobile */}
            <div className="flex-shrink-0 w-1 md:hidden"></div>

            {serviceItems.map((service, index) => {
              const Icon = service.icon;
              
              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  onClick={() => {
                    if (index === 1) {
                      router.push(`/${lang}/servicios-de-comida`);
                    } else {
                      setSelectedService(service);
                    }
                  }}
                  className={`group relative rounded-[2rem] overflow-hidden cursor-pointer shadow-2xl flex-shrink-0 w-[85vw] sm:w-[400px] md:w-auto snap-center md:snap-align-none ${getBentoClasses(index)}`}
                >
                  {/* Background Image */}
                  <Image 
                    src={service.image} 
                    alt={service.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  />
                  
                  {/* Gradient Overlay for Readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A1816]/95 via-[#1A1816]/40 to-transparent transition-opacity duration-500 opacity-80 group-hover:opacity-90"></div>

                  {/* Content Container */}
                  <div className="absolute inset-0 p-6 sm:p-8 md:p-10 flex flex-col justify-end">
                    <div className="transform transition-transform duration-500 translate-y-4 group-hover:translate-y-0">
                      <div className="mb-4 text-[#9B7E67] bg-[#2C2621]/80 backdrop-blur-md p-3 sm:p-4 rounded-full w-fit shadow-xl border border-white/5">
                        <Icon size={24} strokeWidth={1.5} />
                      </div>
                      <h4 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-white mb-2 leading-snug drop-shadow-md">
                        {service.title}
                      </h4>
                      {/* Short description fades in on hover */}
                      <p className="text-white/80 font-light text-sm sm:text-base leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 line-clamp-2 md:line-clamp-3">
                        {service.short}
                      </p>
                      
                      {/* Visual indicator / Explicit Button */}
                      <div className="mt-4 sm:mt-6 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-200">
                        {index === 1 ? (
                          <button className="bg-[#9B7E67] text-white px-6 py-2.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-white hover:text-[#2C2621] transition-all duration-300">
                            Saber más
                          </button>
                        ) : (
                          <>
                            <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] font-semibold text-[#9B7E67]">
                              {(dict as any).services.explore}
                            </span>
                            <div className="w-6 sm:w-8 h-[1px] bg-[#9B7E67]"></div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            
            {/* Spacer for proper right padding on scroll in mobile */}
            <div className="flex-shrink-0 w-1 md:hidden"></div>
          </div>
        </div>
      </section>

      {/* Modal */}
      <ServiceModal service={selectedService} onClose={() => setSelectedService(null)} />
    </>
  );
};

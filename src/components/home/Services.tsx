'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BedDouble, ChefHat, Waves, Droplets, 
  Utensils, Wifi, Sun, Umbrella, MoonStar, 
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import { useDictionary } from '@/i18n/DictionaryContext';
import { ServiceModal, ServiceItem } from './ServiceModal';

const images = [
  '/imagenes/03_rooms/room_extra_img_3549.jpg',
  '/imagenes/05_amenities/amenity_01_kitchen.jpg',
  '/imagenes/05_amenities/amenity_02_pool_lounge.jpg',
  '/imagenes/05_amenities/amenity_04_jacuzzi.jpg',
  '/imagenes/05_amenities/amenity_05_guest_kitchen.jpg',
  '/imagenes/05_amenities/amenity_06_wifi.jpg',
  '/imagenes/05_amenities/amenity_07_sunset_tour.jpg',
  '/imagenes/05_amenities/amenity_08_beach_umbrellas.jpg',
  '/imagenes/05_amenities/amenity_09_rooftop_terrace.jpg'
];

const icons = [
  BedDouble, ChefHat, Waves, Droplets, 
  Utensils, Wifi, Sun, Umbrella, MoonStar
];

export const Services = () => {
  const dict = useDictionary();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const servicesData = (dict as any).services.items;

  // Build the full service items
  const serviceItems: ServiceItem[] = servicesData.map((item: any, index: number) => ({
    id: `service-${index}`,
    title: item.title,
    short: item.short,
    desc: item.desc,
    image: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${images[index]}`,
    icon: icons[index]
  }));

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = window.innerWidth > 768 ? 420 : window.innerWidth * 0.85;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      // Small timeout to let smooth scroll update state
      setTimeout(checkScroll, 400);
    }
  };

  return (
    <>
      <section className="py-20 md:py-32 bg-[#2C2621] text-[#E5E0D8] relative overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-6 md:px-16 mb-10">
          <div>
            <h2 className="text-[#9B7E67] uppercase tracking-[0.3em] text-xs font-bold mb-3">
              {(dict as any).services.subtitle}
            </h2>
            <h3 className="font-serif text-4xl md:text-6xl leading-tight">
              {(dict as any).services.title}
            </h3>
            <div className="mt-4 flex items-center gap-2 text-[#9B7E67]/70 text-xs font-bold tracking-[0.2em] uppercase">
              <span className="block md:hidden opacity-80 animate-pulse">{(dict as any).services.mobileInstruction}</span>
              <span className="hidden md:block opacity-80 animate-pulse">{(dict as any).services.desktopInstruction}</span>
            </div>
          </div>
        </div>

        {/* Gallery Wrapper */}
        <div className="relative group/gallery">
          {/* Desktop Navigation Arrows (Centered on cards) */}
          <div className={`hidden md:flex absolute top-1/2 -translate-y-1/2 left-8 z-10 transition-opacity duration-300 pointer-events-none ${canScrollLeft ? 'opacity-0 group-hover/gallery:opacity-100' : 'opacity-0'}`}>
            <button 
              onClick={() => scroll('left')}
              className="p-4 rounded-full backdrop-blur-md bg-black/40 border transition-all duration-300 pointer-events-auto border-white/20 hover:bg-black/60 hover:border-white/40 text-white cursor-pointer"
            >
              <ChevronLeft size={28} />
            </button>
          </div>
          <div className={`hidden md:flex absolute top-1/2 -translate-y-1/2 right-8 z-10 transition-opacity duration-300 pointer-events-none ${canScrollRight ? 'opacity-0 group-hover/gallery:opacity-100' : 'opacity-0'}`}>
            <button 
              onClick={() => scroll('right')}
              className="p-4 rounded-full backdrop-blur-md bg-black/40 border transition-all duration-300 pointer-events-auto border-white/20 hover:bg-black/60 hover:border-white/40 text-white cursor-pointer"
            >
              <ChevronRight size={28} />
            </button>
          </div>

          {/* Scrollable Gallery */}
          <div 
            ref={scrollRef}
            onScroll={checkScroll}
            className="w-full flex overflow-x-auto snap-x snap-mandatory touch-pan-x pb-12 pt-4 gap-6 md:gap-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {/* Spacer before first card */}
            <div className="flex-shrink-0 w-12 md:w-24 xl:w-[calc((100vw-1400px)/2+4rem)]"></div>
          {serviceItems.map((service, index) => {
            const Icon = service.icon;
            
            return (
              <motion.div
                key={service.id}
                onClick={() => setSelectedService(service)}
                className="group relative flex-shrink-0 w-[85vw] sm:w-[320px] md:w-[380px] h-[450px] md:h-[550px] rounded-2xl overflow-hidden cursor-pointer snap-center md:snap-start transition-transform duration-500 hover:-translate-y-2"
              >
                {/* Background Image */}
                <img 
                  src={service.image} 
                  alt={service.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                
                {/* Dark Gradient Overlay (always visible to read text, gets slightly darker on hover) */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A1816]/90 via-[#1A1816]/30 to-transparent transition-opacity duration-500 group-hover:opacity-100 opacity-80"></div>

                {/* Content */}
                <div className="absolute inset-0 p-8 flex flex-col justify-end">
                  <div className="transform transition-transform duration-500 translate-y-8 group-hover:translate-y-0">
                    <div className="mb-4 text-[#9B7E67] bg-[#2C2621]/80 backdrop-blur-sm p-3 rounded-full w-fit">
                      <Icon size={24} strokeWidth={1.5} />
                    </div>
                    <h4 className="font-serif text-2xl md:text-3xl text-white mb-2 leading-snug">
                      {service.title}
                    </h4>
                    {/* Short description fades in on hover */}
                    <p className="text-white/70 font-light text-sm leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 line-clamp-2">
                      {service.short}
                    </p>
                    
                    {/* Visual indicator to click/explore */}
                    <div className="mt-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-200">
                      <span className="text-xs uppercase tracking-widest font-semibold text-[#9B7E67]">
                        {(dict as any).services.explore}
                      </span>
                      <div className="w-8 h-[1px] bg-[#9B7E67]"></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          
          {/* Spacer after last card */}
          <div className="flex-shrink-0 w-12 md:w-24 xl:w-[calc((100vw-1400px)/2+4rem)]"></div>
        </div>
      </div>
      </section>

      {/* Modal */}
      <ServiceModal service={selectedService} onClose={() => setSelectedService(null)} />
    </>
  );
};

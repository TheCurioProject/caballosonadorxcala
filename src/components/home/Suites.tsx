'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { RoomModal } from './RoomModal';
import { useDictionary } from '@/i18n/DictionaryContext';

export const Suites = ({ rooms }: { rooms: any[] }) => {
  const dict = useDictionary();
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);

  const targetRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollRange, setScrollRange] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Measure the scrollable width vs viewport
  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (scrollContainerRef.current) {
        // We add some padding (e.g. 100px) so the last card doesn't perfectly hug the edge
        const extraPadding = window.innerWidth > 768 ? 200 : 50; 
        setScrollRange(Math.max(0, scrollContainerRef.current.scrollWidth - window.innerWidth + extraPadding));
      }
    };
    
    // Slight delay to ensure DOM is fully painted
    const timer = setTimeout(onResize, 100);
    window.addEventListener('resize', onResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [rooms]);

  const { scrollYProgress } = useScroll({
    target: targetRef,
  });

  // Use a stiff spring for ultra-responsive but smooth scroll tracking
  const smoothProgress = useSpring(scrollYProgress, { 
    stiffness: 400, 
    damping: 60, 
    mass: 0.1,
    restDelta: 0.001
  });

  const x = useTransform(smoothProgress, [0, 1], [0, -scrollRange]);

  return (
    <>
      {/* Container: 400vh on desktop for motion scroll, auto on mobile for native scroll */}
      <section 
        ref={targetRef}
        id="suites" 
        className="relative bg-[#F9F7F4] text-[#23211F] h-auto md:h-[400vh]"
      >
        {/* Pinned Viewport Container (sticky only on md) */}
        <div className="md:sticky md:top-0 md:h-screen flex flex-col justify-center overflow-hidden w-full pt-16 md:pt-0">
          
          <div className="px-6 md:px-24 mb-12 shrink-0 flex items-end justify-between w-full">
            <div>
              <h2 className="text-[#9B7E67] uppercase tracking-[0.3em] text-xs font-bold mb-1 mt-3">{dict.suites.subtitle}</h2>
              <h3 className="font-serif text-5xl md:text-7xl leading-none">{dict.suites.title}</h3>
            </div>
          </div>
          
          {/* Motion Container for the horizontal track (native scroll on mobile) */}
          <div className="w-full border-y border-[#E5E0D8]">
            <motion.div 
              ref={scrollContainerRef}
              style={isMobile ? undefined : { x }}
              className="flex items-stretch w-full overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none md:w-max [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {rooms.map((room, index) => (
                <div 
                  key={`room-${room.id}`}
                  className="w-[85vw] sm:w-[400px] md:w-[450px] shrink-0 group flex flex-col cursor-pointer relative p-10 md:p-14 bg-[#F9F7F4] hover:bg-white border-r border-[#E5E0D8] transition-colors duration-500 min-h-[450px] snap-center md:snap-align-none"
                  onClick={() => setSelectedRoom(room)}
                >
                  <div className="text-[#9B7E67]/50 font-serif italic text-2xl mb-8 pointer-events-none">0{index + 1}</div>
                  <h4 className="font-serif text-4xl md:text-5xl group-hover:text-[#9B7E67] transition-colors duration-500 mb-8 leading-tight pointer-events-none">
                    {room.name.split(' (')[0]}
                  </h4>
                  <p className="text-[#524D48] font-light text-base md:text-lg mb-12 opacity-80 leading-relaxed flex-grow line-clamp-4 pointer-events-none">
                    {room.desc || room.description}
                  </p>
                  
                  <div className="mt-auto pointer-events-none">
                     <span className="inline-block border-b border-[#23211F] group-hover:border-[#9B7E67] pb-1 uppercase tracking-widest text-xs font-semibold group-hover:text-[#9B7E67] transition-colors">
                       {dict.suites.explore}
                     </span>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

        </div>
      </section>

      <RoomModal room={selectedRoom} onClose={() => setSelectedRoom(null)} />
    </>
  );
};

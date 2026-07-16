'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useDictionary } from '@/i18n/DictionaryContext';
import { RoomModal } from './RoomModal';

export const Suites = ({ rooms }: { rooms: any[] }) => {
  const dict = useDictionary();
  const scrollRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const spacerWidth = spacerRef.current ? spacerRef.current.offsetWidth : 10;
      setCanScrollLeft(scrollLeft > spacerWidth + 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();

    let observer: ResizeObserver;
    if (scrollRef.current) {
      observer = new ResizeObserver(() => checkScroll());
      observer.observe(scrollRef.current);
    }

    window.addEventListener('resize', checkScroll);
    return () => {
      window.removeEventListener('resize', checkScroll);
      if (observer) observer.disconnect();
    };
  }, [rooms]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = window.innerWidth > 768 ? 480 : window.innerWidth * 0.85;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 400);
    }
  };

  return (
    <section id="suites" className="relative bg-[#2C2621] text-[#E5E0D8] py-20 md:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-16 mb-12">
        <h2 className="text-[#9B7E67] uppercase tracking-[0.3em] text-xs font-bold mb-1 mt-3">{(dict as any).suites.subtitle}</h2>
        <h3 className="font-serif text-5xl md:text-7xl leading-none text-white">{(dict as any).suites.title}</h3>
        <div className="mt-4 flex items-center gap-2 text-[#9B7E67]/70 text-xs font-bold tracking-[0.2em] uppercase">
          <span className="block md:hidden opacity-80 animate-pulse">{(dict as any).suites.mobileInstruction}</span>
          <span className="hidden md:block opacity-80 animate-pulse">{(dict as any).services.desktopInstruction}</span>
        </div>
      </div>
          
      <div className="relative group/gallery">
        {/* Desktop Navigation Arrows */}
        {canScrollLeft && (
          <div className="hidden md:flex absolute bottom-[7.5rem] left-8 z-10 transition-opacity duration-300">
            <button 
              onClick={() => scroll('left')}
              className="p-4 rounded-full backdrop-blur-md bg-[#1A1816]/80 border transition-all duration-300 shadow-sm border-white/10 hover:bg-[#1A1816] hover:border-white/30 text-white cursor-pointer"
            >
              <ChevronLeft size={28} />
            </button>
          </div>
        )}
        {canScrollRight && (
          <div className="hidden md:flex absolute bottom-[7.5rem] right-8 z-10 transition-opacity duration-300">
            <button 
              onClick={() => scroll('right')}
              className="p-4 rounded-full backdrop-blur-md bg-[#1A1816]/80 border transition-all duration-300 shadow-sm border-white/10 hover:bg-[#1A1816] hover:border-white/30 text-white cursor-pointer"
            >
              <ChevronRight size={28} />
            </button>
          </div>
        )}

        <div className="w-full border-y border-white/10">
          <div 
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex items-stretch w-full overflow-x-auto snap-x snap-mandatory touch-pan-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            <div ref={spacerRef} className="flex-shrink-0 w-12 md:w-24 xl:w-[calc((100vw-1400px)/2+4rem)] border-r border-white/10"></div>
            {rooms.map((room, index) => (
              <div 
                key={`room-${room.id}`}
                className="w-[85vw] sm:w-[400px] md:w-[480px] shrink-0 group flex flex-col relative p-10 md:p-14 bg-[#2C2621] border-r border-white/10 min-h-[450px] snap-center md:snap-start hover:bg-[#23211F] transition-colors duration-500"
              >
                <div className="text-[#9B7E67] uppercase tracking-widest text-xs font-bold mb-3">
                  {(dict as any).suites?.roomPrefix || 'Room'} {index + 1}
                </div>
                <h4 className="font-serif text-4xl md:text-5xl text-white mb-6 leading-tight">
                  {room.name.split(' (')[0]}
                </h4>
                <p className="text-white/70 font-light text-base md:text-lg mb-8 leading-relaxed flex-grow line-clamp-4 group-hover:text-white/90 transition-colors">
                  {room.shortDescription || room.desc || room.description}
                </p>
                <button 
                  onClick={() => setSelectedRoom(room)}
                  className="mt-auto group/btn flex items-center gap-3 w-fit"
                >
                  <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center group-hover/btn:bg-white group-hover/btn:text-[#2C2621] transition-all duration-300">
                    <Plus size={18} />
                  </div>
                  <span className="text-xs uppercase tracking-widest font-bold text-white/70 group-hover/btn:text-white transition-colors">
                    {(dict as any).services?.explore || 'Ver Detalles'}
                  </span>
                </button>
              </div>
            ))}
            <div className="flex-shrink-0 w-12 md:w-24 xl:w-[calc((100vw-1400px)/2+4rem)] border-l border-white/10 ml-[-1px]"></div>
          </div>
        </div>
      </div>

      <RoomModal room={selectedRoom} onClose={() => setSelectedRoom(null)} />
    </section>
  );
};

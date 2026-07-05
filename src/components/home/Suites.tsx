'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDictionary } from '@/i18n/DictionaryContext';

export const Suites = ({ rooms }: { rooms: any[] }) => {
  const dict = useDictionary();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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
    <section id="suites" className="relative bg-[#F9F7F4] text-[#23211F] py-20 md:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-16 mb-12">
        <h2 className="text-[#9B7E67] uppercase tracking-[0.3em] text-xs font-bold mb-1 mt-3">{(dict as any).suites.subtitle}</h2>
        <h3 className="font-serif text-5xl md:text-7xl leading-none">{(dict as any).suites.title}</h3>
        <div className="mt-4 flex items-center gap-2 text-[#9B7E67]/70 text-xs font-bold tracking-[0.2em] uppercase">
          <span className="block md:hidden opacity-80 animate-pulse">{(dict as any).suites.mobileInstruction}</span>
          <span className="hidden md:block opacity-80 animate-pulse">{(dict as any).services.desktopInstruction}</span>
        </div>
      </div>
          
      <div className="relative group/gallery">
        {/* Desktop Navigation Arrows */}
        <div className={`hidden md:flex absolute top-1/2 -translate-y-1/2 left-8 z-10 transition-opacity duration-300 pointer-events-none ${canScrollLeft ? 'opacity-0 group-hover/gallery:opacity-100' : 'opacity-0'}`}>
          <button 
            onClick={() => scroll('left')}
            className="p-4 rounded-full backdrop-blur-md bg-white/80 border transition-all duration-300 pointer-events-auto shadow-sm border-[#23211F]/20 hover:bg-white hover:border-[#23211F]/40 text-[#23211F] cursor-pointer"
          >
            <ChevronLeft size={28} />
          </button>
        </div>
        <div className={`hidden md:flex absolute top-1/2 -translate-y-1/2 right-8 z-10 transition-opacity duration-300 pointer-events-none ${canScrollRight ? 'opacity-0 group-hover/gallery:opacity-100' : 'opacity-0'}`}>
          <button 
            onClick={() => scroll('right')}
            className="p-4 rounded-full backdrop-blur-md bg-white/80 border transition-all duration-300 pointer-events-auto shadow-sm border-[#23211F]/20 hover:bg-white hover:border-[#23211F]/40 text-[#23211F] cursor-pointer"
          >
            <ChevronRight size={28} />
          </button>
        </div>

        <div className="w-full border-y border-[#E5E0D8]">
          <div 
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex items-stretch w-full overflow-x-auto snap-x snap-mandatory touch-pan-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            <div className="flex-shrink-0 w-6 md:w-16 xl:w-[calc((100vw-1400px)/2+4rem)] border-r border-[#E5E0D8]"></div>
            {rooms.map((room, index) => (
              <div 
                key={`room-${room.id}`}
                className="w-[85vw] sm:w-[400px] md:w-[480px] shrink-0 group flex flex-col relative p-10 md:p-14 bg-[#F9F7F4] border-r border-[#E5E0D8] min-h-[450px] snap-center md:snap-start"
              >
                <div className="text-[#9B7E67]/50 font-serif italic text-2xl mb-8">0{index + 1}</div>
                <h4 className="font-serif text-4xl md:text-5xl text-[#23211F] mb-8 leading-tight">
                  {room.name.split(' (')[0]}
                </h4>
                <p className="text-[#524D48] font-light text-base md:text-lg mb-12 opacity-80 leading-relaxed flex-grow line-clamp-4">
                  {room.desc || room.description}
                </p>
              </div>
            ))}
            <div className="flex-shrink-0 w-6 md:w-16 xl:w-[calc((100vw-1400px)/2+4rem)] border-l border-[#E5E0D8] ml-[-1px]"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

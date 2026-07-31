'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDictionary } from '@/i18n/DictionaryContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const fallbackReviews = [
  {
    text: "An absolutely magical experience. The perfect blend of luxury and raw nature. We felt completely immersed in the beauty of Chacala while enjoying world-class comfort.",
    author: "Elena R.",
    rating: 5
  },
  {
    text: "Casa Caballo Soñador is a hidden gem. The attention to detail in the architecture and the warmth of the staff made our stay unforgettable.",
    author: "James M.",
    rating: 5
  },
  {
    text: "Waking up to the sound of the ocean and the jungle birds was spectacular. Every suite is a piece of art. We will definitely be coming back every year.",
    author: "Sofía & Carlos",
    rating: 5
  }
];

export const Reviews = () => {
  const dict = useDictionary() as any;
  const homeReviews = dict?.homeReviews || {
    subtitle: "Guest Experiences",
    title: "Reviews",
    items: fallbackReviews
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 40);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 40);
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
  }, [homeReviews.items]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = window.innerWidth > 768 ? 400 : window.innerWidth * 0.85;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 400);
    }
  };

  return (
    <section id="reviews" className="py-16 md:py-24 bg-[#23211F] text-[#F9F7F4] relative overflow-hidden border-t border-white/10">
      <div className="max-w-[1400px] mx-auto px-6 md:px-16">
        
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
          className="text-center mb-16"
        >
          <motion.span 
            initial={{ opacity: 0, letterSpacing: "0em" }}
            whileInView={{ opacity: 1, letterSpacing: "0.3em" }}
            transition={{ duration: 1.5, delay: 0.2, ease: "easeOut" }}
            className="uppercase text-[#9b6e2f] text-base md:text-lg font-bold block mb-4"
          >
            {homeReviews.subtitle}
          </motion.span>
          <h2 className="font-serif text-4xl md:text-7xl">
            {homeReviews.title}
          </h2>
        </motion.div>

        <div className="relative group/reviews">
          {/* Desktop Navigation Arrows */}
          {canScrollLeft && (
            <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 -left-4 lg:-left-12 z-10 transition-opacity duration-300">
              <button 
                onClick={() => scroll('left')}
                className="p-4 rounded-full backdrop-blur-md bg-[#1A1816]/80 border transition-all duration-300 shadow-sm border-white/10 hover:bg-[#1A1816] hover:border-white/30 text-white cursor-pointer"
              >
                <ChevronLeft size={28} />
              </button>
            </div>
          )}
          {canScrollRight && (
            <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 -right-4 lg:-right-12 z-10 transition-opacity duration-300">
              <button 
                onClick={() => scroll('right')}
                className="p-4 rounded-full backdrop-blur-md bg-[#1A1816]/80 border transition-all duration-300 shadow-sm border-white/10 hover:bg-[#1A1816] hover:border-white/30 text-white cursor-pointer"
              >
                <ChevronRight size={28} />
              </button>
            </div>
          )}

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.2
                }
              }
            }}
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex items-stretch gap-6 md:gap-8 w-[calc(100%+3rem)] md:w-[calc(100%+8rem)] -mx-6 md:-mx-16 overflow-x-auto snap-x snap-mandatory touch-pan-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-8 pt-4 px-[7.5vw] md:px-16 scroll-pl-[7.5vw] md:scroll-pl-16"
          >
            {homeReviews.items.map((review: any, idx: number) => (
              <motion.div
                key={idx}
                variants={{
                  hidden: { opacity: 0, y: 30, scale: 0.95 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }
                }}
                whileHover={{ scale: 1.02, transition: { duration: 0.3 } }}
                className="w-[85vw] sm:w-[350px] md:w-[400px] shrink-0 snap-center md:snap-start flex flex-col items-center text-center space-y-6 bg-[#161412] p-8 md:p-10 rounded-2xl border border-[#F9F7F4]/5 hover:border-[#9b6e2f]/30 transition-colors"
              >
                <div className="flex space-x-1 text-[#9b6e2f]">
                  {[...Array(review.rating || 5)].map((_, i) => (
                    <svg 
                      key={i} 
                      className="w-5 h-5 fill-current" 
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                </div>
                <p className="font-serif text-xl italic text-gray-300 leading-relaxed flex-grow">
                  "{review.text}"
                </p>
                <div>
                  <h4 className="font-bold tracking-widest uppercase text-base md:text-lg">{review.author}</h4>
                  {review.location && <span className="text-gray-500 text-sm md:text-base tracking-widest uppercase block mt-1">{review.location}</span>}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

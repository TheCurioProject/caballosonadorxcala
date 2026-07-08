'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bed, Users, Bath, Droplets, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { useBooking } from '@/context/BookingContext';
import { useDictionary } from '@/i18n/DictionaryContext';
import { useScrollLock } from '@/hooks/useScrollLock';

interface RoomModalProps {
  room: any | null;
  onClose: () => void;
}

export const RoomModal = ({ room, onClose }: RoomModalProps) => {
  const { openBookingModal } = useBooking();
  const [activeTab, setActiveTab] = useState<'suite' | 'cocina'>('suite');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Reset tab and image index when room changes
  useEffect(() => {
    setActiveTab('suite');
    setCurrentImageIndex(0);
    setIsFullscreen(false);
  }, [room]);

  useScrollLock(!!room);

  const dict = useDictionary();
  const isRoom7 = room?.id === 7;
  const isCocina = activeTab === 'cocina';

  const getTitle = () => {
    if (!room) return '';
    if (isRoom7) {
      return isCocina ? (dict as any).roomsData.cocinaName : room.name;
    }
    return room.name;
  };

  const getDescription = () => {
    if (!room) return '';
    if (isCocina) {
      return (dict as any).roomsData.cocinaDesc;
    }
    return room.desc || room.description;
  };

  const images = room?.images || [];
  
  const handleNextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    }
  };

  const handlePrevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }
  };

  const toggleFullscreen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsFullscreen(!isFullscreen);
  };

  const carouselContent = (
    <div className={`relative w-full h-full bg-black flex items-center justify-center overflow-hidden group ${isFullscreen ? 'cursor-default' : 'cursor-pointer'}`} onClick={!isFullscreen ? toggleFullscreen : undefined}>
      {images.map((img: string, idx: number) => (
        <motion.img
          key={img + idx}
          src={img}
          alt={`Room image ${idx + 1}`}
          className={`absolute inset-0 w-full h-full ${isFullscreen ? 'object-contain' : 'object-cover'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: currentImageIndex === idx ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          style={{ pointerEvents: currentImageIndex === idx ? 'auto' : 'none', touchAction: 'pan-y' }}
          drag={currentImageIndex === idx ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(e, { offset }) => {
            const swipe = offset.x;
            if (swipe < -50) {
              handleNextImage();
            } else if (swipe > 50) {
              handlePrevImage();
            }
          }}
        />
      ))}

      {/* Fullscreen toggle button */}
      <button 
        onClick={toggleFullscreen}
        className="absolute top-6 right-6 z-20 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-colors border border-white/20 opacity-0 group-hover:opacity-100"
      >
        {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
      </button>

      {/* Navigation arrows */}
      <button 
        onClick={handlePrevImage}
        className={`hidden md:block absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all duration-300 border border-white/20 z-20 ${currentImageIndex === 0 ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100 pointer-events-auto'}`}
      >
        <ChevronLeft size={24} />
      </button>
      
      <button 
        onClick={handleNextImage}
        className={`hidden md:block absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all duration-300 border border-white/20 z-20 ${currentImageIndex === images.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100 pointer-events-auto'}`}
      >
        <ChevronRight size={24} />
      </button>
      
      {/* Indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {images.map((_: any, idx: number) => (
            <div 
              key={idx} 
              className={`w-2 h-2 rounded-full transition-all duration-300 ${currentImageIndex === idx ? 'bg-white scale-125' : 'bg-white/40'}`} 
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {room && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[100] bg-[#F9F7F4] flex flex-col overflow-hidden"
          >
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 z-50 p-3 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full text-white transition-colors border border-white/20"
            >
              <X size={24} />
            </button>

            {/* Top Section: Carousel */}
            <div className="w-full h-[45vh] md:h-[55vh] relative bg-black shrink-0">
               {carouselContent}
            </div>

            {/* Bottom Section: Info */}
            <div className="w-full flex-1 bg-[#F9F7F4] flex flex-col justify-center">
              <div className="max-w-5xl mx-auto p-6 md:p-12 w-full flex flex-col">
                
                {/* Tabs for Room 7 */}
                {isRoom7 && (
                  <div className="flex border-b border-[#E5E0D8] mb-8 gap-4">
                    <button 
                      onClick={() => setActiveTab('suite')}
                      className={`pb-4 px-2 uppercase tracking-widest text-[10px] md:text-xs font-bold transition-colors ${activeTab === 'suite' ? 'border-b-2 border-[#9B7E67] text-[#9B7E67]' : 'text-[#524D48] hover:text-[#23211F]'}`}
                    >
                      {room.name}
                    </button>
                    <button 
                      onClick={() => setActiveTab('cocina')}
                      className={`pb-4 px-2 uppercase tracking-widest text-[10px] md:text-xs font-bold transition-colors ${activeTab === 'cocina' ? 'border-b-2 border-[#9B7E67] text-[#9B7E67]' : 'text-[#524D48] hover:text-[#23211F]'}`}
                    >
                      {(dict as any).roomsData.cocinaName}
                    </button>
                  </div>
                )}

                <h2 className="font-serif text-4xl md:text-5xl text-[#23211F] mb-6 leading-tight">{getTitle()}</h2>
                
                <div className="flex flex-col md:flex-row gap-10 md:gap-16 flex-grow">
                  {/* Description */}
                  <div className="w-full md:w-[60%]">
                    <p className="text-[#524D48] font-light text-base md:text-lg leading-relaxed mb-8">
                      {getDescription()}
                    </p>
                  </div>

                  {/* Details & Action */}
                  <div className="w-full md:w-[40%] flex flex-col">
                    {!isCocina && room.details && (
                      <div className="grid grid-cols-1 gap-4 text-sm text-[#524D48] mb-8 border-l border-[#E5E0D8] pl-6">
                        <div className="flex items-center gap-3"><Users size={16} className="text-[#9B7E67]" /> {room.details.guests} {dict.modal.guests}</div>
                        <div className="flex items-center gap-3"><Bed size={16} className="text-[#9B7E67]" /> {room.details.beds}</div>
                        <div className="flex items-center gap-3"><Bath size={16} className="text-[#9B7E67]" /> {room.details.bath}</div>
                        {room.details.extra && <div className="flex items-center gap-3"><Droplets size={16} className="text-[#9B7E67]" /> {room.details.extra}</div>}
                      </div>
                    )}

                    <div className="mt-auto pt-6 border-t border-[#E5E0D8] flex flex-col gap-4">
                      {!isCocina && room.price !== undefined && (
                        <span className="font-serif italic text-2xl text-[#23211F]">{room.price === 0 ? '' : room.price}</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Overlay */}
      <AnimatePresence>
        {isFullscreen && room && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[200] bg-black flex flex-col"
          >
            {/* Close Fullscreen Button */}
            <button 
              onClick={toggleFullscreen}
              className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-colors border border-white/20"
            >
              <X size={24} />
            </button>
            <div className="w-full h-full">
              {carouselContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

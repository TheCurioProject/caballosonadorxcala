'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bed, Users, Bath, Droplets, ChevronLeft, ChevronRight, Maximize2, Minimize2, Wifi, Tv } from 'lucide-react';
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
    <div className="relative w-full h-full bg-[#1A1816] flex items-center justify-center overflow-hidden group">
      {images.length > 0 ? (
        <>
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

          {/* Navigation arrows */}
          {currentImageIndex > 0 && (
            <button 
              onClick={handlePrevImage}
              className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all duration-300 border border-white/20 z-20 opacity-0 group-hover:opacity-100 pointer-events-auto"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          
          {currentImageIndex < images.length - 1 && (
            <button 
              onClick={handleNextImage}
              className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all duration-300 border border-white/20 z-20 opacity-0 group-hover:opacity-100 pointer-events-auto"
            >
              <ChevronRight size={24} />
            </button>
          )}
          
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
        </>
      ) : (
        <div className="flex flex-col items-center justify-center text-white/50 p-8 text-center gap-4">
          <Bed size={48} className="opacity-40" />
          <p className="text-base md:text-lg uppercase tracking-widest font-medium">Fotos de la habitación próximamente</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {room && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="bg-[#F9F7F4] w-full max-w-7xl max-h-[90vh] md:h-[80vh] flex flex-col md:flex-row overflow-hidden relative shadow-2xl rounded-none md:rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 md:top-6 md:right-6 z-50 p-2 md:p-3 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full text-white transition-colors border border-white/20"
              >
                <X size={20} className="md:w-6 md:h-6" />
              </button>

              {/* Left/Top Section: Carousel (50%) */}
              <div className="w-full md:w-1/2 h-[40vh] md:h-full relative bg-black shrink-0">
                 {carouselContent}
              </div>

              {/* Right/Bottom Section: Info (50%) */}
              <div className="w-full md:w-1/2 bg-[#F9F7F4] flex flex-col h-full overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#E5E0D8] hover:[&::-webkit-scrollbar-thumb]:bg-[#D0C8BC]">
                <div className="p-8 md:p-12 w-full flex flex-col h-full">
                  
                  <h2 className="font-serif text-3xl md:text-5xl text-[#23211F] mb-6 leading-tight shrink-0">{getTitle()}</h2>
                  
                  <div className="flex flex-col flex-grow">
                    {/* Description */}
                    <div className="w-full mb-8">
                      <p className="text-[#524D48] font-light text-lg md:text-xl leading-relaxed">
                        {getDescription()}
                      </p>
                    </div>

                    {/* Details & Action */}
                    <div className="w-full mt-auto flex flex-col shrink-0">
                      {!isCocina && room.details && (
                        <div className="grid grid-cols-2 gap-4 text-base md:text-lg text-[#524D48] mb-8 border-t border-[#E5E0D8] pt-8">
                          <div className="flex items-center gap-3"><Users size={16} className="text-[#9B7E67]" /> {room.details.guests} {dict.modal.guests}</div>
                          <div className="flex items-center gap-3"><Bed size={16} className="text-[#9B7E67]" /> {room.details.beds}</div>
                          <div className="flex items-center gap-3"><Bath size={16} className="text-[#9B7E67]" /> {room.details.bath}</div>
                          <div className="flex items-center gap-3"><Wifi size={16} className="text-[#9B7E67]" /> Wi-Fi</div>
                          {room.details.extra && <div className="flex items-center gap-3"><Droplets size={16} className="text-[#9B7E67]" /> {room.details.extra}</div>}
                          {isRoom7 && <div className="flex items-center gap-3"><Tv size={16} className="text-[#9B7E67]" /> TV</div>}
                        </div>
                      )}

                      <div className="pt-6 border-t border-[#E5E0D8] flex flex-col gap-4">
                        {!isCocina && room.price !== undefined && (
                          <span className="font-serif italic text-2xl text-[#23211F]">{room.price === 0 ? '' : room.price}</span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </>
  );
};

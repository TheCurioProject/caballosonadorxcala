'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bed, Users, Bath, Droplets } from 'lucide-react';
import { VideoScrubber } from './VideoScrubber';
import { useBooking } from '@/context/BookingContext';
import { useDictionary } from '@/i18n/DictionaryContext';

interface RoomModalProps {
  room: any | null;
  onClose: () => void;
}

export const RoomModal = ({ room, onClose }: RoomModalProps) => {
  const { openBookingModal } = useBooking();
  const [activeTab, setActiveTab] = useState<'suite' | 'cocina'>('suite');

  // Reset tab when room changes
  useEffect(() => {
    setActiveTab('suite');
  }, [room]);

  useEffect(() => {
    if (room) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      // Para Safari móvil
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => { 
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [room]);

  const dict = useDictionary();
  const isRoom7 = room?.id === 7;
  const isCocina = activeTab === 'cocina';
  
  const currentVideoUrl = isRoom7 
    ? (isCocina ? room.videoDownUrl : room.videoUrl)
    : room?.videoUrl;

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

  return (
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

          {/* Top Section: Video (60vh) */}
          <div className="w-full h-[55vh] md:h-[65vh] relative bg-black shrink-0">
             <VideoScrubber roomId={isRoom7 ? (isCocina ? 'suite-down' : 'suite') : room.id.toString()} />
          </div>

          {/* Bottom Section: Info (45vh / 35vh) */}
          <div className="w-full flex-1 overflow-y-auto overscroll-contain touch-pan-y bg-[#F9F7F4]">
            <div className="max-w-5xl mx-auto p-8 md:p-12 w-full flex flex-col min-h-full">
              
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
                    <button 
                      onClick={() => {
                        onClose();
                        openBookingModal();
                      }}
                      className="bg-[#23211F] text-[#F9F7F4] px-8 py-4 uppercase tracking-widest text-xs font-bold hover:bg-[#9B7E67] transition-colors w-full text-center mt-2"
                    >
                      {dict.nav.book}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
};

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';

export interface ServiceItem {
  id: string;
  title: string;
  short: string;
  desc: string;
  image: string;
  icon: React.ElementType;
}

interface ServiceModalProps {
  service: ServiceItem | null;
  onClose: () => void;
}

export const ServiceModal = ({ service, onClose }: ServiceModalProps) => {
  useScrollLock(!!service);

  return (
    <AnimatePresence>
      {service && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6 pointer-events-none">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" 
            onClick={onClose} 
          />

          {/* Modal Content Container */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", opacity: 0, transition: { type: "tween", duration: 0.25, ease: "easeIn" } }}
            transition={{ 
              type: "spring", 
              damping: 25, 
              stiffness: 250
            }}
            className="relative w-full md:max-w-4xl bg-[#2C2621] rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] md:max-h-[90vh] z-10 pointer-events-auto md:flex-row"
          >
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 z-50 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-colors border border-white/20"
            >
              <X size={20} />
            </button>

            {/* Image Section */}
            <div className="w-full relative bg-black shrink-0 md:w-1/2 h-[35vh] md:h-[500px]">
              <Image 
                src={service.image} 
                alt={service.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover opacity-90"
              />
              {/* Subtle overlay */}
              <div className="absolute inset-0 pointer-events-none opacity-80 bg-gradient-to-t md:bg-gradient-to-r from-[#2C2621] via-transparent to-transparent"></div>
            </div>

            {/* Text Section */}
            <div className="w-full flex-1 overflow-y-auto overscroll-contain touch-pan-y bg-[#2C2621] flex flex-col justify-center md:w-1/2 p-8 md:p-10">
              
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-[#9B7E67]/20 rounded-full text-[#E5E0D8] p-3">
                  {React.createElement(service.icon, { size: 24, strokeWidth: 1.5 })}
                </div>
                <h2 className="font-serif text-[#E5E0D8] leading-tight text-3xl md:text-4xl">
                  {service.title}
                </h2>
              </div>
              
              <div className="flex flex-col gap-4">
                <h3 className="text-lg md:text-xl font-light text-[#E5E0D8] opacity-90">
                  {service.short}
                </h3>
                <p className="text-[#E5E0D8] font-light text-base md:text-lg leading-relaxed opacity-70">
                  {service.desc}
                </p>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

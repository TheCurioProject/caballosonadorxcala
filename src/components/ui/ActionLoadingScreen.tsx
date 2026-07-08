'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const FluidHorseAnimation = dynamic(() => import('../FluidHorseAnimation'), {
  ssr: false,
});
import { Loader2 } from 'lucide-react';

interface ActionLoadingScreenProps {
  isOpen: boolean;
  message?: string;
  subMessage?: string;
}

export function ActionLoadingScreen({ isOpen, message, subMessage }: ActionLoadingScreenProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
        >
          <div className="flex flex-col items-center pointer-events-auto bg-[#F9F7F4] p-10 md:p-14 rounded-[2rem] shadow-2xl shadow-black/40 border border-white/20 text-center relative overflow-hidden">
            {/* Subtle glow effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#9B7E67]/10 to-transparent pointer-events-none" />
            
            <FluidHorseAnimation className="w-24 h-24 md:w-32 md:h-32 text-[#9B7E67] drop-shadow-xl mb-6 relative z-10" />
            
            {message && (
              <p className="text-[#23211F] font-serif text-2xl md:text-3xl mb-3 relative z-10">{message}</p>
            )}
            
            {(subMessage || !message) && (
              <div className="flex items-center gap-3 relative z-10">
                <Loader2 className="w-4 h-4 text-[#9B7E67] animate-spin" />
                {subMessage && (
                  <p className="text-[#9B7E67] text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold">
                    {subMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

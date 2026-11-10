'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const FluidHorseAnimation = dynamic(() => import('../FluidHorseAnimation'), {
  ssr: false,
});

interface ActionLoadingScreenProps {
  isOpen: boolean;
  message?: string;
  subMessage?: string;
  theme?: 'light' | 'dark';
}

export function ActionLoadingScreen({ isOpen, message, subMessage, theme = 'light' }: ActionLoadingScreenProps) {
  const isDark = theme === 'dark';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-black/65 backdrop-blur-md pointer-events-auto"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0, padding: '1rem' }}
        >
          <div className={`flex flex-col items-center p-8 sm:p-12 md:p-14 rounded-[2rem] shadow-2xl border text-center relative overflow-hidden max-w-lg w-full ${isDark ? 'bg-[#0A0908] shadow-black/80 border-white/10' : 'bg-[#F9F7F4] shadow-black/40 border-white/20'}`}>
            {/* Subtle glow effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#9B7E67]/10 to-transparent pointer-events-none" />
            
            <FluidHorseAnimation className="w-24 h-24 md:w-32 md:h-32 text-[#9B7E67] drop-shadow-xl mb-6 relative z-10" />
            
            {message && (
              <p className={`font-serif text-2xl md:text-3xl mb-3 relative z-10 ${isDark ? 'text-[#F9F7F4]' : 'text-[#23211F]'}`}>{message}</p>
            )}
            
            {(subMessage || !message) && (
              <div className="flex items-center gap-3 relative z-10 justify-center">
                <Loader2 className="w-4 h-4 text-[#9B7E67] animate-spin" />
                {subMessage && (
                  <p className="text-[#9B7E67] text-[10px] md:text-xs uppercase tracking-[0.25em] font-bold">
                    {subMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

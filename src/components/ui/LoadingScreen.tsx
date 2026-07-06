'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogoCompleto } from './LogoCompleto';
import FluidHorseAnimation from '../FluidHorseAnimation';
export function LoadingScreen() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Tiempo de carga cinematográfico (más largo para poder apreciar el logo nuevo)
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="loading-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] bg-[#0A0908] flex flex-col items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-white flex flex-col items-center relative"
          >
            {/* Resplandor radial que crece con el logo */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.5, 0], scale: [0.5, 1.2, 1.5] }}
              transition={{ duration: 3, ease: "easeInOut" }}
              className="absolute inset-0 bg-[#F9F7F4]/20 blur-3xl rounded-full z-0 pointer-events-none"
            />
            
            <div className="relative z-10">
              <FluidHorseAnimation className="w-[50vw] max-w-[180px] md:max-w-[220px] lg:max-w-[280px] text-white" />
            </div>
            
            {/* Resplandor lineal inferior */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="mt-12 w-48 h-[1px] overflow-hidden relative"
            >
              <motion.div 
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="absolute inset-y-0 w-full bg-gradient-to-r from-transparent via-[#9B7E67] to-transparent shadow-[0_0_10px_#9B7E67]"
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

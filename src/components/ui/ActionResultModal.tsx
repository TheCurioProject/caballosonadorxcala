'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertTriangle, X } from 'lucide-react';
import dynamic from 'next/dynamic';

const FluidHorseAnimation = dynamic(() => import('../FluidHorseAnimation'), {
  ssr: false,
});

export interface ActionResultModalProps {
  isOpen: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
  detail?: string;
  onClose: () => void;
}

export function ActionResultModal({
  isOpen,
  type,
  title,
  message,
  detail,
  onClose,
}: ActionResultModalProps) {
  const isSuccess = type === 'success';
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
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/65 backdrop-blur-md p-4 sm:p-6"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#F9F7F4] text-[#23211F] p-7 sm:p-10 rounded-[2rem] shadow-2xl border border-white/40 max-w-lg w-full relative overflow-hidden text-center"
          >
            {/* Subtle glow effect matching ActionLoadingScreen */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#9B7E67]/10 via-transparent to-transparent pointer-events-none" />

            {/* Close button in top-right */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon / Animation */}
            <div className="relative z-10 flex justify-center mb-5">
              {isSuccess ? (
                <div className="flex flex-col items-center">
                  <FluidHorseAnimation className="w-20 h-20 text-[#9B7E67] drop-shadow-md mb-2" />
                  <div className="w-12 h-12 rounded-full bg-emerald-100/90 text-emerald-700 flex items-center justify-center border border-emerald-300/60 shadow-inner">
                    <Check className="w-6 h-6 stroke-[2.5]" />
                  </div>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-rose-100/90 text-rose-700 flex items-center justify-center border border-rose-300/60 shadow-inner">
                  <AlertTriangle className="w-8 h-8 stroke-[2]" />
                </div>
              )}
            </div>

            {/* Badge */}
            <div className="relative z-10 mb-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${
                  isSuccess
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                {isSuccess ? 'Success' : 'Attention Required'}
              </span>
            </div>

            {/* Title */}
            <h3 className="font-serif text-2xl sm:text-3xl text-[#23211F] mb-3 relative z-10 font-normal">
              {title}
            </h3>

            {/* Primary message */}
            <p className="text-gray-600 text-sm sm:text-base font-light leading-relaxed mb-5 relative z-10">
              {message}
            </p>

            {/* Exact error / detail panel (if present) */}
            {detail && (
              <div className="relative z-10 mb-6 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Result details:
                </p>
                <div
                  className={`p-3.5 rounded-xl text-xs max-h-48 overflow-y-auto leading-relaxed border ${
                    isSuccess
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900 font-sans'
                      : 'bg-rose-50/90 border-rose-200 text-rose-900 font-mono'
                  }`}
                >
                  {detail}
                </div>
              </div>
            )}

            {/* Action button */}
            <div className="relative z-10 pt-2">
              <button
                onClick={onClose}
                className={`w-full py-3.5 px-6 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-md active:scale-[0.99] text-white ${
                  isSuccess
                    ? 'bg-[#2C2927] hover:bg-[#1A1817]'
                    : 'bg-rose-700 hover:bg-rose-800'
                }`}
              >
                {isSuccess ? 'Dismiss' : 'Close and Review Feeds'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

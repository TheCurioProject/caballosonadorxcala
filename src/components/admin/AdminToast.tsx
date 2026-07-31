'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface AdminToastProps {
  isOpen: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

export function AdminToast({
  isOpen,
  message,
  type = 'success',
  onClose,
}: AdminToastProps) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-400" />;
      default:
        return <Info className="w-5 h-5 text-[#9B7E67]" />;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-emerald-500/30 bg-emerald-950/80 text-emerald-100';
      case 'error':
        return 'border-rose-500/30 bg-rose-950/80 text-rose-100';
      default:
        return 'border-[#9B7E67]/30 bg-[#2C2927]/90 text-[#F9F7F4]';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed top-6 right-6 z-[999999] pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            className={`flex items-center gap-3 px-5 py-4 rounded-xl border shadow-xl backdrop-blur-xl max-w-md ${getBorderColor()}`}
          >
            <div className="flex-shrink-0">{getIcon()}</div>
            <p className="text-sm font-medium leading-snug flex-1">{message}</p>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 opacity-70 hover:opacity-100" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

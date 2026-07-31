'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, Trash2, X, Loader2 } from 'lucide-react';

interface AdminConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AdminConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: AdminConfirmModalProps) {
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <Trash2 className="w-6 h-6 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      default:
        return <Info className="w-6 h-6 text-[#9B7E67]" />;
    }
  };

  const getConfirmButtonStyle = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-900/20';
      default:
        return 'bg-[#9B7E67] hover:bg-[#23211F] text-white shadow-[#9B7E67]/20';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isLoading ? undefined : onCancel}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
            className="relative w-full max-w-md bg-[#2C2927] border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl text-[#F9F7F4] overflow-hidden"
          >
            {/* Ambient Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#9B7E67]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            {!isLoading && (
              <button
                onClick={onCancel}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex-shrink-0">
                {getIcon()}
              </div>

              <div className="flex-1">
                <h3 className="text-xl font-serif font-bold text-white mb-2">
                  {title}
                </h3>
                <p className="text-base md:text-lg text-gray-300 leading-relaxed font-light">
                  {description}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                disabled={isLoading}
                onClick={onCancel}
                className="px-5 py-2.5 rounded-xl font-bold text-sm md:text-base uppercase tracking-wider text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={onConfirm}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm md:text-base uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 ${getConfirmButtonStyle()}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

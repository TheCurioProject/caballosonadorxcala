'use client';

import React, { useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const FluidHorseAnimation = dynamic(() => import('@/components/FluidHorseAnimation'), {
  ssr: false,
});
import { removeBooking } from './actions';

export default function DeleteBookingButton({ bookingId }: { bookingId: number }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm('¿Estás seguro de que deseas eliminar esta reserva permanentemente?')) {
      startTransition(async () => {
        await removeBooking(bookingId);
      });
    }
  };

  return (
    <>
      <button 
        onClick={handleDelete} 
        disabled={isPending}
        className="text-xs font-bold uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors"
      >
        Delete
      </button>

      <AnimatePresence>
        {isPending && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center">
              <FluidHorseAnimation className="w-24 h-24 text-[#9B7E67] drop-shadow-lg mb-4" />
              <Loader2 className="w-8 h-8 text-[#9B7E67] animate-spin mb-4" />
              <p className="text-[#23211F] font-serif text-xl">Eliminando reserva...</p>
              <p className="text-gray-500 text-sm uppercase tracking-widest font-bold mt-2">Por favor, espera</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

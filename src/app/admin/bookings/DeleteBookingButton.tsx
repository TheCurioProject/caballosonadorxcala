'use client';

import React, { useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const FluidHorseAnimation = dynamic(() => import('@/components/FluidHorseAnimation'), {
  ssr: false,
});
import { removeBooking } from './actions';
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal';

export default function DeleteBookingButton({ bookingId }: { bookingId: number }) {
  const [isPending, startTransition] = useTransition();
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);

  const handleDeleteConfirm = () => {
    setIsConfirmOpen(false);
    startTransition(async () => {
      await removeBooking(bookingId);
    });
  };

  return (
    <>
      <button 
        onClick={() => setIsConfirmOpen(true)} 
        disabled={isPending}
        className="text-sm md:text-base font-bold uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors"
      >
        Delete
      </button>

      <AdminConfirmModal 
        isOpen={isConfirmOpen}
        title="Delete Booking"
        description="Are you sure you want to permanently delete this booking? This action cannot be undone."
        confirmText="Delete Permanently"
        variant="danger"
        isLoading={isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsConfirmOpen(false)}
      />

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
              <p className="text-[#23211F] font-serif text-xl">Deleting booking...</p>
              <p className="text-gray-500 text-base md:text-lg uppercase tracking-widest font-bold mt-2">Please wait</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

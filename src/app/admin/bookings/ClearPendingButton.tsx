'use client';

import React, { useState, useTransition } from 'react';
import { clearPendingBookings } from './actions';
import { Loader2, Trash2 } from 'lucide-react';
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal';
import { AdminToast } from '@/components/admin/AdminToast';

export default function ClearPendingButton({ all = false, label = 'Clear Expired Locks' }: { all?: boolean, label?: string }) {
  const [isPending, startTransition] = useTransition();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [toastState, setToastState] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' }>({
    isOpen: false,
    message: '',
    type: 'success',
  });

  const handleClearConfirm = () => {
    setIsConfirmOpen(false);
    startTransition(async () => {
      const res = await clearPendingBookings(all);
      if (res.success) {
        setToastState({
          isOpen: true,
          message: `Released ${res.count} temporary date hold(s); reservation details were kept.`,
          type: 'success',
        });
      } else {
        setToastState({
          isOpen: true,
          message: res.error || 'Error clearing temporary date holds.',
          type: 'error',
        });
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsConfirmOpen(true)}
        disabled={isPending}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs md:text-[10px] font-bold tracking-widest uppercase rounded-md transition-colors ${
          all 
            ? 'bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50'
            : 'bg-orange-50 text-orange-600 hover:bg-orange-100 disabled:opacity-50'
        }`}
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Trash2 className="w-3 h-3" />
        )}
        {isPending ? 'Processing...' : label}
      </button>

      <AdminConfirmModal
        isOpen={isConfirmOpen}
        title={all ? "Clear ALL Pending Holds" : "Clear Expired Holds"}
        description={all ? "Are you sure you want to release ALL pending unpaid booking holds while keeping their reservation details?" : "Are you sure you want to clear holds older than 35 minutes while keeping their reservation details?"}
        confirmText="Clear Holds"
        variant="warning"
        isLoading={isPending}
        onConfirm={handleClearConfirm}
        onCancel={() => setIsConfirmOpen(false)}
      />

      <AdminToast
        isOpen={toastState.isOpen}
        message={toastState.message}
        type={toastState.type}
        onClose={() => setToastState(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}

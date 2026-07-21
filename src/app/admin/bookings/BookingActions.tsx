'use client';

import React, { useState } from 'react';
import { Trash2, Edit } from 'lucide-react';
import EditBookingModal from './EditBookingModal';
import { removeBooking } from './actions';

export default function BookingActions({ booking, basePrice }: { booking: any, basePrice: number }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to cancel the booking for ${booking.guestName}?`)) {
      setIsDeleting(true);
      await removeBooking(booking.id);
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex justify-end gap-2">
        {booking.origin === 'MANUAL' && (
          <button
            onClick={() => setIsEditOpen(true)}
            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center"
            title="Edit Booking"
          >
            <Edit className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
          title="Cancel Booking"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {isEditOpen && (
        <EditBookingModal 
          booking={booking}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          basePrice={basePrice}
        />
      )}
    </>
  );
}

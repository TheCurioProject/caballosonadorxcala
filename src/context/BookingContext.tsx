'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { PremiumBookingModal } from '@/components/booking/PremiumBookingModal';

interface BookingContextProps {
  openBookingModal: () => void;
  closeBookingModal: () => void;
}

const BookingContext = createContext<BookingContextProps | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openBookingModal = () => setIsOpen(true);
  const closeBookingModal = () => setIsOpen(false);

  return (
    <BookingContext.Provider value={{ openBookingModal, closeBookingModal }}>
      {children}
      <PremiumBookingModal isOpen={isOpen} onClose={closeBookingModal} />
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}

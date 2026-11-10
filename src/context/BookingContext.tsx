'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import dynamic from 'next/dynamic';

const PremiumBookingModal = dynamic(
  () => import('@/components/booking/PremiumBookingModal').then(mod => mod.PremiumBookingModal),
  { ssr: false }
);

interface BookingContextProps {
  openBookingModal: () => void;
  closeBookingModal: () => void;
  openLodgingBooking: (lodgingId: string) => void;
}

const BookingContext = createContext<BookingContextProps | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [{ isOpen, openVersion, lodgingId }, setBookingState] = useState({ isOpen: false, openVersion: 0, lodgingId: undefined as string | undefined });

  const openBookingModal = () => setBookingState(current => current.isOpen
    ? current
    : { isOpen: true, openVersion: current.openVersion + 1, lodgingId: undefined });
  const openLodgingBooking = (id: string) => setBookingState(current => ({isOpen:true, openVersion:current.openVersion+1, lodgingId:id}));
  const closeBookingModal = () => setBookingState(current => ({ ...current, isOpen: false }));

  return (
    <BookingContext.Provider value={{ openBookingModal, closeBookingModal, openLodgingBooking }}>
      {children}
      <PremiumBookingModal key={openVersion} isOpen={isOpen} onClose={closeBookingModal} smoobuOpenVersion={openVersion} initialLodgingId={lodgingId} />
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

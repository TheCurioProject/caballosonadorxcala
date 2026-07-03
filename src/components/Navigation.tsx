'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeNavigation } from './home/Navigation';
import { useBooking } from '@/context/BookingContext';

export default function Navigation() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const { openBookingModal } = useBooking();

  if (pathname.startsWith('/admin')) {
    return null;
  }

  if (isHome) {
    return <HomeNavigation />;
  }

  // Minimal Navigation for non-home pages
  return (
    <nav className="fixed top-0 w-full z-50 transition-all duration-300 py-6 px-6 md:px-16 pointer-events-none">
      <div className="max-w-[1400px] mx-auto flex justify-between items-center mix-blend-difference text-white pointer-events-auto">
        <Link 
          href="/" 
          className="uppercase tracking-widest text-xs font-bold hover:opacity-70 transition-opacity flex items-center gap-2"
        >
          ← Volver al Inicio
        </Link>
        <button 
          onClick={openBookingModal}
          className="border border-white rounded-full px-8 py-3 uppercase tracking-[0.2em] text-xs font-bold hover:bg-white hover:text-black transition-colors"
        >
          Reserva
        </button>
      </div>
    </nav>
  );
}

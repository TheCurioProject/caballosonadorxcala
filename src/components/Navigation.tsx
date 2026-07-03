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

  return <HomeNavigation />;
}

'use client';

import { usePathname } from 'next/navigation';
import { HomeNavigation } from './home/Navigation';

export default function Navigation() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin') || pathname.includes('/tours') || pathname.includes('/servicios-de-comida') || pathname.includes('/politicas') || pathname.includes('/writers-group')) {
    return null;
  }

  return <HomeNavigation />;
}

'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Book, CalendarDays, CreditCard, Settings, CalendarSync, LogOut } from 'lucide-react';

import { motion } from 'framer-motion';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/admin/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Bookings', href: '/admin/bookings', icon: Book },
    { name: 'Calendar', href: '/admin/calendar', icon: CalendarDays },
    { name: 'Payments', href: '/admin/stripe', icon: CreditCard },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
    { name: 'iCal', href: '/admin/ical', icon: CalendarSync },
  ];

  const mobileNavItems = [
    { name: 'Inicio', href: '/admin', icon: LayoutDashboard },
    { name: 'Reservas', href: '/admin/bookings', icon: Book },
    { name: 'Fechas', href: '/admin/calendar', icon: CalendarDays },
    { name: 'Ajustes', href: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-[#F9F7F4] text-[#23211F] pb-24 md:pb-0">
      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-[#2C2927] text-[#F9F7F4] flex-col shadow-xl z-20 hidden md:flex">
        <div className="p-8 border-b border-[#F9F7F4]/10">
          <h1 className="font-serif text-2xl font-bold tracking-wide text-[#9B7E67]">Casa Caballo Soñador</h1>
          <p className="text-xs font-light opacity-60 uppercase tracking-widest mt-2">Admin Panel</p>
        </div>
        <nav className="flex-1 py-8 px-4 flex flex-col space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                className={`px-4 py-3 rounded-lg transition-colors font-medium text-sm flex items-center gap-3 ${isActive ? 'bg-[#9B7E67] text-white' : 'hover:bg-white/5 text-gray-300'}`}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-8 border-t border-[#F9F7F4]/10">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-sm font-medium text-red-400 hover:text-red-300 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full md:h-screen overflow-hidden relative">
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Bottom Navigation Bar (Mobile) - Rediseño Premium */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#2C2927]/90 backdrop-blur-xl border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-50 px-2 pb-safe pt-2">
        <div className="flex justify-around items-center h-16 relative">
          
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                className="relative flex flex-col items-center justify-center w-full h-full group"
              >
                {isActive && (
                  <motion.div 
                    layoutId="mobileNavIndicator"
                    className="absolute inset-0 mx-2 my-1 bg-[#9B7E67]/20 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`relative z-10 flex flex-col items-center justify-center space-y-1 transition-colors duration-300 ${isActive ? 'text-[#9B7E67]' : 'text-gray-400 group-hover:text-gray-300'}`}
                >
                  <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`} />
                  <span className={`text-[9px] uppercase tracking-widest font-bold transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                    {item.name}
                  </span>
                </motion.div>
              </Link>
            );
          })}

          <button 
            onClick={handleLogout} 
            className="relative flex flex-col items-center justify-center w-full h-full group"
          >
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="relative z-10 flex flex-col items-center justify-center space-y-1 text-red-400/80 group-hover:text-red-400 transition-colors duration-300"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-[9px] uppercase tracking-widest font-bold opacity-70 group-hover:opacity-100">
                Salir
              </span>
            </motion.div>
          </button>
        </div>
      </nav>
    </div>
  );
}

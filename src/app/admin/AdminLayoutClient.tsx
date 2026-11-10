'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Book, 
  CalendarDays, 
  CreditCard, 
  Settings, 
  CalendarSync, 
  LogOut, 
  Image as ImageIcon, 
  Menu, 
  X,
  Sparkles,
  Compass,
  BookOpen,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/\/$/, '') || '/';
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const dragControls = useDragControls();
  const isLoginPage = pathname.includes('/admin/login');

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

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
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, desc: 'Overview & Analytics' },
    { name: 'Bookings', href: '/admin/bookings', icon: Book, desc: 'Guest Reservations' },
    { name: 'Tour Bookings', href: '/admin/tours-bookings', icon: Compass, desc: 'Tour Reservations' },
    { name: 'Calendar', href: '/admin/calendar', icon: CalendarDays, desc: 'Availability & Date Lock' },
    { name: 'Edit Content', href: '/admin/content', icon: ImageIcon, desc: 'Site Media & Images' },
    { name: 'Experiences', href: '/admin/experiencias', icon: Sparkles, desc: 'Guest Activities' },
    { name: 'Writers Group', href: '/admin/writers-group', icon: BookOpen, desc: 'Manage Workshops' },
    { name: 'During Your Stay', href: '/admin/during-your-stay', icon: Sparkles, desc: 'Manage Amenities' },
    { name: 'Payments', href: '/admin/stripe', icon: CreditCard, desc: 'Stripe Transactions' },
    { name: 'iCal Sync', href: '/admin/ical', icon: CalendarSync, desc: 'Calendar Integrations' },
    { name: 'Settings', href: '/admin/settings', icon: Settings, desc: 'System Configuration' },
  ];

  return (
    <div className="min-h-screen flex bg-[#F9F7F4] text-[#23211F] pb-24 md:pb-0">
      
      {/* Top Instant Navigation Loader Bar */}
      {isNavigating && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-1.5 bg-[#9B7E67]/20 overflow-hidden">
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
            className="w-1/2 h-full bg-[#9B7E67] rounded-full shadow-[0_0_8px_#9B7E67]"
          />
        </div>
      )}

      {/* Floating Toggle Button (Desktop) */}
      {!isSidebarOpen && !isLoginPage && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-6 left-6 z-50 p-3 bg-white rounded-full shadow-lg border border-gray-100 text-[#23211F] hover:bg-gray-50 transition-all hidden md:flex"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Sidebar (Desktop) */}
      <aside className={`w-64 bg-[#2C2927] text-[#F9F7F4] flex-col shadow-xl z-20 hidden md:flex transition-all duration-300 ${isSidebarOpen ? 'ml-0' : '-ml-64'}`}>
        <div className="p-8 border-b border-[#F9F7F4]/10 relative">
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-8 right-6 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
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
                onClick={() => {
                  if (pathname !== item.href) {
                    setIsNavigating(true);
                  }
                }} 
                className={`px-4 py-3 rounded-lg transition-colors font-medium text-sm flex items-center gap-3 ${isActive ? 'bg-[#9B7E67] text-white' : 'hover:bg-white/5 text-gray-300'}`}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-8 border-t border-[#F9F7F4]/10">
          <Link 
            href="/es" 
            className="flex items-center gap-3 text-sm font-medium text-gray-400 hover:text-white transition-colors w-full mb-4"
          >
            <Globe className="w-4 h-4" />
            View Public Site
          </Link>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-sm font-medium text-red-400 hover:text-red-300 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen md:h-screen md:overflow-hidden relative">
        <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-8 pb-28 md:pb-36 overflow-y-auto overflow-x-hidden w-full">
          {children}
        </main>
      </div>

      {/* Tools Drawer (Mobile Bottom Sheet) */}
      <AnimatePresence>
        {isToolsOpen && (
          <div className="md:hidden fixed inset-0 z-[1000] flex flex-col justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsToolsOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />

            {/* Bottom Sheet Card */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 300) {
                  setIsToolsOpen(false);
                }
              }}
              className="relative z-10 bg-[#2C2927] border-t border-white/10 rounded-t-3xl p-6 pt-2 shadow-2xl text-[#F9F7F4] max-h-[85vh] overflow-y-auto"
            >
              {/* Drag Handle Indicator */}
              <div 
                className="w-full py-4 flex justify-center cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-12 h-1.5 bg-white/20 rounded-full" />
              </div>

              <div 
                className="flex items-center justify-between mb-6 pb-4 border-b border-white/10 cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div>
                  <h2 className="font-serif text-xl font-bold text-[#9B7E67]">Admin Tools</h2>
                  <p className="text-xs text-gray-400 font-light">Select a category to navigate</p>
                </div>
                <button
                  onPointerDown={(e) => e.stopPropagation()} // Prevent drag on button
                  onClick={() => setIsToolsOpen(false)}
                  className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid of Categories */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => {
                        if (pathname !== item.href) {
                          setIsNavigating(true);
                        }
                        setIsToolsOpen(false);
                      }}
                      className={`flex flex-col p-4 rounded-2xl border transition-all duration-200 ${
                        isActive 
                          ? 'bg-[#9B7E67]/20 border-[#9B7E67] text-white shadow-lg' 
                          : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl w-fit mb-3 ${isActive ? 'bg-[#9B7E67] text-white' : 'bg-white/10 text-[#9B7E67]'}`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm text-white mb-0.5">{item.name}</span>
                      <span className="text-xs md:text-[10px] text-gray-400 font-light leading-snug">{item.desc}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Actions inside Drawer */}
              <div className="flex flex-col gap-3 mt-4">
                <Link
                  href="/es"
                  className="w-full py-3.5 px-4 bg-white/5 border border-white/10 text-gray-300 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  View Public Site
                </Link>
                <button
                  onClick={() => {
                    setIsToolsOpen(false);
                    handleLogout();
                  }}
                  className="w-full py-3.5 px-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation (Mobile) - Central Tools Button */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-6 left-0 right-0 z-[900] flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setIsToolsOpen(!isToolsOpen)}
            className={`w-14 h-14 rounded-2xl bg-[#2C2927] border border-white/15 text-white flex items-center justify-center shadow-2xl transition-all duration-300 ${
              isToolsOpen ? 'ring-4 ring-white/20 scale-105' : 'hover:bg-[#3A3634]'
            }`}
            aria-label="Tools Menu"
          >
            {isToolsOpen ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <Menu className="w-6 h-6 text-white" />
            )}
          </motion.button>
        </div>
      </nav>
    </div>
  );
}

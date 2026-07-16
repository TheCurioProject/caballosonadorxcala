'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Globe } from 'lucide-react';
import { LogoCompleto } from '../ui/LogoCompleto';
import { useBooking } from '@/context/BookingContext';
import { useDictionary } from '@/i18n/DictionaryContext';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const FluidHorseAnimation = dynamic(() => import('../FluidHorseAnimation'), {
  ssr: false,
});
import { useScrollLock } from '@/hooks/useScrollLock';

const SideMenu = ({ isOpen, setIsOpen, setIsSwitchingLang }: { isOpen: boolean, setIsOpen: (v: boolean) => void, setIsSwitchingLang: (v: boolean) => void }) => {
  const { openBookingModal } = useBooking();
  const dict = useDictionary();
  const pathname = usePathname();
  const router = useRouter();

  // Scroll lock removido para permitir navegar con el menú abierto

  const changeLanguage = (lang: string) => {
    setIsSwitchingLang(true);
    
    // Guardar cookie para que el RootLayout lo lea
    document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000`;
    
    const segments = pathname.split('/');
    if (segments.length > 1 && ['es', 'en'].includes(segments[1])) {
      segments[1] = lang;
    } else {
      segments.splice(1, 0, lang);
    }
    
    // Forzamos un reload completo tras un breve tiempo para mostrar la animación y
    // asegurar que TODO el árbol de componentes (incluyendo RootLayout) se actualice con el nuevo idioma.
    setTimeout(() => {
      window.location.href = segments.join('/') || '/';
    }, 800);
    setIsOpen(false);
  };
  const menuVariants: any = {
    closed: { x: "100%", transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } },
    open: { x: 0, transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }
  };

  const overlayVariants: any = {
    closed: { opacity: 0, transition: { duration: 0.5 } },
    open: { opacity: 1, transition: { duration: 0.5 } }
  };

  const linkVariants: any = {
    closed: { x: 50, opacity: 0 },
    open: (i: number) => ({ x: 0, opacity: 1, transition: { delay: 0.3 + (i * 0.1), duration: 0.5 } })
  };

  const langMatch = pathname.match(/^\/(es|en)/);
  const langPrefix = langMatch ? langMatch[0] : '/es';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay para cerrar al hacer click fuera */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-[45] bg-transparent"
          />
          {/* Premium Editorial Floating Menu - Compact Version */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.9, y: -20, filter: 'blur(10px)' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{ transformOrigin: 'top right' }}
            className="fixed z-50 bg-[#F9F7F4]/95 backdrop-blur-2xl border border-white/40 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col
                       top-[80px] right-4 w-[calc(100vw-32px)] sm:w-[320px] rounded-2xl px-6 py-4
                       md:top-[70px] md:right-10 md:px-7 md:py-5 pointer-events-auto"
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#9B7E67]">
                Menú
              </span>
              <button 
                onClick={() => setIsOpen(false)} 
                className="hover:rotate-90 transition-transform duration-500 text-[#2C2927]/60 hover:text-[#2C2927] p-2 -mr-2"
                aria-label="Cerrar menú"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <Link
                href={`/#suites`}
                onClick={() => {
                  setIsOpen(false);
                  setTimeout(() => {
                    document.getElementById('suites')?.scrollIntoView({ behavior: 'smooth' });
                  }, 500);
                }}
                className="group flex items-center justify-between py-1.5"
              >
                <span className="font-serif text-2xl md:text-3xl text-[#2C2927] group-hover:text-[#9B7E67] transition-colors duration-500">
                  {dict?.nav?.rooms || 'Habitaciones'}
                </span>
                <span className="text-[#9B7E67] opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 ease-out">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </span>
              </Link>

              <Link
                href={`${langPrefix}/tours`}
                onClick={() => setIsOpen(false)}
                className="group flex items-center justify-between py-1.5"
              >
                <span className="font-serif text-2xl md:text-3xl text-[#2C2927] group-hover:text-[#9B7E67] transition-colors duration-500">
                  {dict?.nav?.tours || 'Experiencias'}
                </span>
                <span className="text-[#9B7E67] opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 ease-out">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </span>
              </Link>

              <Link
                href={`${langPrefix}/servicios-de-comida`}
                onClick={() => {
                  setIsOpen(false);
                }}
                className="group flex items-center justify-between py-1.5"
              >
                <span className="font-serif text-2xl md:text-3xl text-[#2C2927] group-hover:text-[#9B7E67] transition-colors duration-500">
                  {langPrefix === '/en' ? 'Food Service' : 'Servicio de Comida'}
                </span>
                <span className="text-[#9B7E67] opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 ease-out">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </span>
              </Link>

              <Link
                href={`/#location`}
                onClick={() => {
                  setIsOpen(false);
                  setTimeout(() => {
                    document.getElementById('location')?.scrollIntoView({ behavior: 'smooth' });
                  }, 500);
                }}
                className="group flex items-center justify-between py-1.5"
              >
                <span className="font-serif text-2xl md:text-3xl text-[#2C2927] group-hover:text-[#9B7E67] transition-colors duration-500">
                  {dict?.nav?.findUs || 'Encuentranos'}
                </span>
                <span className="text-[#9B7E67] opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 ease-out">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </span>
              </Link>

              <div className="w-full h-px bg-[#2C2927]/10 my-2" />

              <div className="flex flex-col gap-3">
                <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#2C2927]/40">
                  {dict?.footer?.contact || 'Contacto'}
                </p>
                <div className="flex flex-col gap-2">
                  <a href="mailto:info@hotel.com" className="font-light text-sm text-[#2C2927]/80 hover:text-[#9B7E67] transition-colors flex items-center gap-3 group">
                    <div className="w-7 h-7 rounded-full bg-[#2C2927]/5 flex items-center justify-center group-hover:bg-[#9B7E67]/10 transition-colors">
                      <svg className="w-3.5 h-3.5 text-[#2C2927] group-hover:text-[#9B7E67] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    </div>
                    info@hotel.com
                  </a>
                  <a href="https://wa.me/12509612351" target="_blank" rel="noopener noreferrer" className="font-light text-sm text-[#2C2927]/80 hover:text-[#9B7E67] transition-colors flex items-center gap-3 group">
                    <div className="w-7 h-7 rounded-full bg-[#2C2927]/5 flex items-center justify-center group-hover:bg-[#9B7E67]/10 transition-colors">
                      <svg className="w-3.5 h-3.5 text-[#2C2927] group-hover:text-[#9B7E67] transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824zm-3.423-14.416c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm.029 18.88c-1.161 0-2.305-.292-3.318-.844l-3.677.964.984-3.595c-.607-1.052-.927-2.246-.926-3.468.001-3.825 3.113-6.937 6.937-6.937 3.825 0 6.938 3.112 6.938 6.938 0 3.825-3.113 6.938-6.938 6.938z"/></svg>
                    </div>
                    +1(250)961-2351
                  </a>
                  <div className="flex gap-3 mt-1">
                    <a href="https://www.instagram.com/casacaballosonador/" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-[#2C2927]/5 flex items-center justify-center text-[#2C2927] hover:bg-[#9B7E67] hover:text-white transition-all duration-300">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    </a>
                    <a href="https://www.facebook.com/AlexandKelliMexico/" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-[#2C2927]/5 flex items-center justify-center text-[#2C2927] hover:bg-[#9B7E67] hover:text-white transition-all duration-300">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export const HomeNavigation = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const [isSwitchingLang, setIsSwitchingLang] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const dict = useDictionary();
  const { openBookingModal } = useBooking();

  const changeLanguage = (lang: string) => {
    setIsSwitchingLang(true);
    document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000`;
    const segments = pathname.split('/');
    if (segments.length > 1 && ['es', 'en'].includes(segments[1])) {
      segments[1] = lang;
    } else {
      segments.splice(1, 0, lang);
    }
    setTimeout(() => {
      window.location.href = segments.join('/') || '/';
    }, 800);
  };

  useEffect(() => {
    // Ya no lo apagamos inmediatamente si estamos cambiando de idioma, 
    // porque forzaremos un reload y queremos que la animación permanezca.
    // Solo lo apagamos en el montaje inicial.
    if (!isSwitchingLang) {
      setIsSwitchingLang(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (menuOpen) {
      setHidden(false);
    }
  }, [menuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 50);
      
      const suitesSection = document.getElementById('suites');
      let hideForSuites = false;
      if (suitesSection) {
        const rect = suitesSection.getBoundingClientRect();
        hideForSuites = rect.top <= 100 && rect.bottom >= 100;
      }
      
      if (menuOpen) {
        setHidden(false);
      } else if (hideForSuites) {
        setHidden(true);
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 500) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScrollY.current = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [menuOpen]);

  const isSolid = scrolled || menuOpen;

  return (
    <>
      <AnimatePresence>
        {isSwitchingLang && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-[#0A0908]/90 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="flex flex-col items-center">
              <FluidHorseAnimation className="w-24 h-24 md:w-32 md:h-32 text-[#F9F7F4] drop-shadow-2xl" />
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="mt-8 text-[#9B7E67] font-sans text-xs tracking-[0.3em] uppercase font-bold"
              >
                {dict?.nav?.changingLanguage || "Cambiando idioma..."}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className={`fixed top-0 w-full z-40 transition-transform duration-500 ease-in-out ${hidden ? '-translate-y-full' : 'translate-y-0'}`}>
        <div className={`transition-all duration-500 ${isSolid ? 'py-3 bg-[#F9F7F4]/95 backdrop-blur-lg shadow-sm' : 'py-4 md:py-6 bg-transparent'}`}>
          <div className={`max-w-[1400px] mx-auto px-6 md:px-16 grid grid-cols-2 md:grid-cols-3 items-start md:items-center transition-colors duration-500 relative ${isSolid ? 'text-[#2C2927]' : 'text-[#F9F7F4]'}`}>
            
            {/* Logo a la izquierda */}
            <div className="flex justify-start self-start">
              <Link 
                href={`/${pathname.split('/')[1] || 'es'}`} 
                aria-label="Inicio" 
                className="flex items-start"
              >
                <motion.div
                  layout
                  initial={false}
                  transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
                  className={`origin-top-left flex items-start ${
                    isSolid ? 'translate-y-0' : 'translate-y-2 md:translate-y-4'
                  }`}
                >
                  <LogoCompleto 
                    layout
                    transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
                    solidWhite={!isSolid}
                    className={`w-auto drop-shadow-lg hover:scale-105 transition-transform duration-300 origin-top-left ${
                      isSolid ? 'h-8 md:h-10' : 'h-[3.5rem] md:h-[5rem]'
                    }`} 
                  />
                </motion.div>
              </Link>
            </div>

            <div className="hidden md:flex justify-center z-20 pointer-events-auto">
              <div className="flex items-center gap-2 md:gap-4">
                {['es', 'en'].map((l) => {
                  const currentLang = pathname.split('/')[1] || 'es';
                  const isActive = currentLang === l;
                  return (
                    <button 
                      key={l}
                      onClick={() => changeLanguage(l)}
                      className={`relative flex flex-col items-center justify-center transition-all duration-300 ease-out py-1 ${
                        isActive ? 'opacity-100 scale-110 font-bold' : 'opacity-40 hover:opacity-100 font-medium'
                      }`}
                    >
                      <span className="text-[11px] md:text-sm leading-none block tracking-widest">{l.toUpperCase()}</span>
                      <div className="h-1.5 mt-1 w-full flex justify-center items-center">
                        {isActive && (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSolid 
                                ? 'bg-[#2C2927]' 
                                : 'bg-[#F9F7F4] shadow-[0_0_4px_rgba(0,0,0,0.6)]'
                            }`} 
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Header Right Content */}
            <div className="flex flex-col items-end gap-1 md:gap-2 z-10">
              <div className="flex justify-end items-center gap-3 md:gap-5">
                {/* Desktop Booking Button */}
                <button 
                  onClick={() => openBookingModal()}
                  className={`hidden md:block uppercase tracking-widest text-[10px] font-bold border rounded-full px-4 py-1.5 hover:opacity-70 transition-all ${isSolid ? 'border-[#2C2927] text-[#2C2927]' : 'border-[#F9F7F4] text-[#F9F7F4]'}`}
                >
                  {dict?.nav?.reserveBtn || 'RESERVAR'}
                </button>

                {/* Hamburger Menu */}
                <button 
                  onClick={() => setMenuOpen(true)}
                  className="uppercase tracking-widest text-xs font-bold flex items-center gap-2 hover:opacity-70 transition-all"
                >
                  {dict?.nav?.menu || 'MENU'} <Menu size={20} />
                </button>
              </div>

              {/* Mobile Language Switcher */}
              <div className="flex md:hidden items-center gap-3 z-20 pointer-events-auto mr-1">
                {['es', 'en'].map((l) => {
                  const currentLang = pathname.split('/')[1] || 'es';
                  const isActive = currentLang === l;
                  return (
                    <button 
                      key={l}
                      onClick={() => changeLanguage(l)}
                      className={`relative flex flex-col items-center justify-center transition-all duration-300 ease-out py-1 ${
                        isActive ? 'opacity-100 scale-110 font-bold' : 'opacity-40 hover:opacity-100 font-medium'
                      }`}
                    >
                      <span className="text-[10px] leading-none block tracking-widest">{l.toUpperCase()}</span>
                      <div className="h-1 mt-1 w-full flex justify-center items-center">
                        {isActive && (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className={`w-1 h-1 rounded-full ${
                              isSolid 
                                ? 'bg-[#2C2927]' 
                                : 'bg-[#F9F7F4] shadow-[0_0_4px_rgba(0,0,0,0.6)]'
                            }`} 
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Floating Booking Button */}
      <button
        onClick={() => openBookingModal()}
        className={`md:hidden fixed bottom-6 left-6 z-40 bg-[#9B7E67] text-[#F9F7F4] px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg hover:scale-105 transition-all duration-500 ${hidden ? 'translate-y-24' : 'translate-y-0'}`}
      >
        {dict?.nav?.reserveBtn || 'RESERVAR'}
      </button>

      <SideMenu isOpen={menuOpen} setIsOpen={setMenuOpen} setIsSwitchingLang={setIsSwitchingLang} />
    </>
  );
};

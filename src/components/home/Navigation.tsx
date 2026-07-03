'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Globe } from 'lucide-react';
import { LogoCompleto } from '../ui/LogoCompleto';
import { useBooking } from '@/context/BookingContext';
import { useDictionary } from '@/i18n/DictionaryContext';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import FluidHorseAnimation from '../FluidHorseAnimation';

const SideMenu = ({ isOpen, setIsOpen, setIsSwitchingLang }: { isOpen: boolean, setIsOpen: (v: boolean) => void, setIsSwitchingLang: (v: boolean) => void }) => {
  const { openBookingModal } = useBooking();
  const dict = useDictionary();
  const pathname = usePathname();
  const router = useRouter();

  const changeLanguage = (lang: string) => {
    setIsSwitchingLang(true);
    // pathname es /es/algo o /en/algo, reemplazamos el primer segmento
    const segments = pathname.split('/');
    if (segments.length > 1 && ['es', 'en', 'de'].includes(segments[1])) {
      segments[1] = lang;
    } else {
      segments.splice(1, 0, lang);
    }
    router.push(segments.join('/') || '/');
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

  const links = [
    { name: dict.nav.rooms, href: '#suites' },
    { name: dict.nav.tours, href: '#experiencias' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay oscuro de fondo */}
          <motion.div 
            initial="closed"
            animate="open"
            exit="closed"
            variants={overlayVariants}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-[#0A0908]/60 backdrop-blur-sm touch-none"
          />
          
          {/* Panel Lateral Compacto */}
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={menuVariants}
            className="fixed top-0 right-0 h-full w-full max-w-[380px] z-50 bg-[#2C2927] text-[#F9F7F4] flex flex-col pt-32 px-10 shadow-2xl overflow-y-auto overscroll-contain"
          >
            <button onClick={() => setIsOpen(false)} className="absolute top-10 right-10 text-[#F9F7F4] hover:rotate-90 transition-transform duration-500">
              <X size={32} strokeWidth={1} />
            </button>

            <div className="flex flex-col space-y-8 mt-10">
              {links.map((link, i) => (
                <motion.a
                  key={link.name}
                  href={link.href}
                  custom={i}
                  variants={linkVariants}
                  onClick={() => setIsOpen(false)}
                  className="font-serif text-3xl sm:text-4xl hover:italic hover:opacity-70 transition-all cursor-pointer"
                >
                  {link.name}
                </motion.a>
              ))}
              
              <motion.div custom={2} variants={linkVariants} className="pt-10">
                <button 
                  onClick={() => {
                    setIsOpen(false);
                    openBookingModal();
                  }}
                  className="w-full block text-center border border-[#F9F7F4] rounded-full px-8 py-4 uppercase tracking-[0.2em] text-xs hover:bg-[#F9F7F4] hover:text-[#2C2927] transition-all cursor-pointer"
                >
                  {dict.nav.book}
                </button>
              </motion.div>

              <motion.div custom={2.5} variants={linkVariants} className="pt-6 flex justify-center gap-6 border-t border-[#F9F7F4]/10 mt-6">
                {['es', 'en', 'de'].map((l) => (
                  <button
                    key={l}
                    onClick={() => changeLanguage(l)}
                    className={`uppercase tracking-widest text-xs font-bold transition-all ${
                      pathname.startsWith(`/${l}`) ? 'text-[#9B7E67]' : 'text-gray-400 hover:text-[#F9F7F4]'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </motion.div>

              <motion.div custom={3} variants={linkVariants} className="pt-12 mt-auto pb-10">
                <div className="flex flex-col gap-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-400">{dict.footer.contact}</p>
                  <div className="flex flex-col gap-4">
                    <a href="mailto:info@hotel.com" className="font-light text-sm hover:text-[#9B7E67] transition-colors flex items-center gap-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                      info@hotel.com
                    </a>
                    <a href="https://wa.me/12509612351" target="_blank" rel="noopener noreferrer" className="font-light text-sm hover:text-[#9B7E67] transition-colors flex items-center gap-3">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824zm-3.423-14.416c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm.029 18.88c-1.161 0-2.305-.292-3.318-.844l-3.677.964.984-3.595c-.607-1.052-.927-2.246-.926-3.468.001-3.825 3.113-6.937 6.937-6.937 3.825 0 6.938 3.112 6.938 6.938 0 3.825-3.113 6.938-6.938 6.938z"/></svg>
                      +1(250)961-2351
                    </a>
                    <a href="https://www.instagram.com/casacaballosonador/" target="_blank" rel="noopener noreferrer" className="font-light text-sm hover:text-[#9B7E67] transition-colors flex items-center gap-3">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                      Instagram
                    </a>
                    <a href="https://www.facebook.com/AlexandKelliMexico/" target="_blank" rel="noopener noreferrer" className="font-light text-sm hover:text-[#9B7E67] transition-colors flex items-center gap-3">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                      Facebook
                    </a>
                  </div>
                </div>
              </motion.div>
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
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isSwitchingLang, setIsSwitchingLang] = useState(false);
  const pathname = usePathname();
  const dict = useDictionary();

  useEffect(() => {
    setIsSwitchingLang(false);
  }, [pathname]);

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
      
      if (hideForSuites) {
        setHidden(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 500) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      setLastScrollY(currentScrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

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
        <div className={`transition-all duration-500 ${scrolled ? 'py-4 bg-[#F9F7F4]/95 backdrop-blur-lg shadow-sm' : 'py-10 bg-transparent'}`}>
          <div className={`max-w-[1400px] mx-auto px-6 md:px-16 flex justify-between items-center transition-colors duration-500 relative ${scrolled ? 'text-[#2C2927]' : 'text-[#F9F7F4]'}`}>
            
            {/* Logo a la izquierda */}
            <Link href={`/${pathname.split('/')[1] || 'es'}`} aria-label="Inicio" className="flex items-center">
              <LogoCompleto 
                solidWhite={!scrolled}
                className={`w-auto transition-all duration-700 ease-[0.76,0,0.24,1] drop-shadow-lg hover:scale-105 ${scrolled ? 'h-10 md:h-12' : 'h-12 md:h-16'}`} 
              />
            </Link>

            {/* Menú a la derecha */}
            <button 
              onClick={() => setMenuOpen(true)}
              className="uppercase tracking-widest text-xs font-bold flex items-center gap-2 hover:opacity-70 transition-all ml-auto z-10"
            >
              MENU <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      <SideMenu isOpen={menuOpen} setIsOpen={setMenuOpen} setIsSwitchingLang={setIsSwitchingLang} />
    </>
  );
};

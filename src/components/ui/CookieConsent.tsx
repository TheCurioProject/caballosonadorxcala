'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDictionary } from '@/i18n/DictionaryContext';
import { Info } from 'lucide-react';

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dict = useDictionary() as any;

  // Simple language detection fallback if dictionary doesn't map directly to a known key
  const currentLangCode = dict?.nav?.rooms === 'Rooms' ? 'en' : dict?.nav?.rooms === 'Zimmer' ? 'de' : 'es';
  const isEn = currentLangCode === 'en';

  useEffect(() => {
    // Check if user already accepted
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      // Delay showing the popup slightly for a smoother entrance
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: 150, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 150, opacity: 0, transition: { duration: 0.5 } }}
        // Compact floating pill style for mobile, slightly larger for desktop
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-[360px] z-[9999] bg-[#F9F7F4]/95 backdrop-blur-2xl border border-[#9B7E67]/20 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] rounded-2xl overflow-hidden"
      >
        <div className="p-4 md:p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[#23211F]">
            <Info size={16} className="text-[#9B7E67] shrink-0" />
            <h4 className="text-sm md:text-base font-bold font-serif leading-none">
              {isEn ? 'Cookie Preferences' : 'Preferencias de Cookies'}
            </h4>
          </div>
          
          <AnimatePresence mode="wait">
            {!expanded ? (
              <motion.div
                key="compact"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[11px] md:text-xs text-gray-600 font-light leading-relaxed"
              >
                {isEn 
                  ? 'We use essential cookies to remember your language preference and optimize your experience. '
                  : 'Usamos cookies esenciales para recordar tu idioma preferido y optimizar tu experiencia. '}
                <button 
                  onClick={() => setExpanded(true)}
                  className="text-[#9B7E67] font-bold hover:underline inline"
                >
                  {isEn ? 'Read more' : 'Leer más'}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="expanded"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[11px] md:text-xs text-gray-500 space-y-2 mt-1 border-t border-gray-200/50 pt-3 font-light leading-relaxed"
              >
                <p>
                  {isEn 
                    ? 'This site only uses functional cookies that are strictly necessary for the operation of the website, such as remembering your language selection across visits.'
                    : 'Este sitio solo utiliza cookies funcionales estrictamente necesarias para la operación del portal, como recordar tu selección de idioma entre visitas.'}
                </p>
                <p>
                  {isEn
                    ? 'No third-party tracking or advertising cookies are used.'
                    : 'No utilizamos cookies de seguimiento de terceros ni publicidad.'}
                </p>
                <button 
                  onClick={() => setExpanded(false)}
                  className="text-[#9B7E67] font-bold hover:underline block pt-1"
                >
                  {isEn ? 'Show less' : 'Mostrar menos'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 mt-1 pt-2 border-t border-gray-100">
            <button 
              onClick={handleAccept}
              className="flex-1 bg-[#23211F] text-white text-xs md:text-sm py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#9B7E67] transition-colors"
            >
              {isEn ? 'Accept & Continue' : 'Aceptar y Continuar'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

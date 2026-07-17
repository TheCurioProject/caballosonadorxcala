'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Mail } from 'lucide-react';
import { LogoNuevo } from '../ui/LogoNuevo';
import { useBooking } from '@/context/BookingContext';
import { useDictionary } from '@/i18n/DictionaryContext';

export const Footer = () => {
  const { openBookingModal } = useBooking();
  const dict = useDictionary();
  return (
    <footer className="relative z-30 bg-[#161412] text-[#F9F7F4] pt-32 pb-16 px-6 md:px-16 overflow-hidden">
      {/* Gran logo difuminado de fondo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none w-[120%] md:w-[80%]">
        <LogoNuevo solidWhite={true} className="w-full h-auto" />
      </div>

      <div className="max-w-[1400px] mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-24">
          
          {/* Columna 1: Branding y llamada a la acción */}
          <div className="lg:col-span-2">
            <h2 className="font-serif text-5xl md:text-7xl mb-8 leading-[0.9] text-[#9B7E67]">
              {dict.footer.slogan}
            </h2>
            <p className="text-gray-400 font-light mb-10 max-w-sm text-lg leading-relaxed">
              {dict.about.p1}
            </p>
            <button 
              onClick={openBookingModal}
              className="inline-flex items-center justify-center bg-[#9B7E67] text-[#F9F7F4] rounded-full px-10 py-5 uppercase tracking-widest text-xs font-bold hover:bg-[#F9F7F4] hover:text-[#161412] transition-colors duration-500"
            >
              {dict.nav.book}
            </button>
          </div>
          
          {/* Columna 2: Contacto y Ubicación */}
          <div className="flex flex-col space-y-8 font-light text-sm text-gray-400">
            <div>
              <p className="uppercase tracking-widest font-bold text-[#F9F7F4] mb-4 text-xs">{dict.footer.location}</p>
              <a 
                href="https://maps.app.goo.gl/av6UPu8yyY8WcsX86" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-start gap-3 hover:text-[#9B7E67] transition-colors group"
              >
                <MapPin size={18} className="mt-1 shrink-0 text-[#9B7E67] group-hover:scale-110 transition-transform" />
                <span className="leading-relaxed">13 Ecuador, 63715<br />Chacala, Nayarit<br />Mexico</span>
              </a>
            </div>
            <div>
              <p className="uppercase tracking-widest font-bold text-[#F9F7F4] mb-4 text-xs">{dict.footer.contact}</p>
              <a href="https://wa.me/12509612351" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-[#9B7E67] transition-colors group mb-3">
                <svg className="w-[18px] h-[18px] text-[#9B7E67] group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824zm-3.423-14.416c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm.029 18.88c-1.161 0-2.305-.292-3.318-.844l-3.677.964.984-3.595c-.607-1.052-.927-2.246-.926-3.468.001-3.825 3.113-6.937 6.937-6.937 3.825 0 6.938 3.112 6.938 6.938 0 3.825-3.113 6.938-6.938 6.938z"/></svg>
                +1(250)961-2351
              </a>
              <a href="mailto:kelli9@telus.net" className="flex items-center gap-3 hover:text-[#9B7E67] transition-colors group">
                <Mail size={18} className="text-[#9B7E67] group-hover:scale-110 transition-transform" />
                kelli9@telus.net
              </a>
            </div>
          </div>

          {/* Columna 3: Información General y Redes */}
          <div className="flex flex-col space-y-8 font-light text-sm text-gray-400">
            <div>
              <p className="uppercase tracking-widest font-bold text-[#F9F7F4] mb-4 text-xs">{dict.footer.hours}</p>
              <p className="mb-2">Check-in: 3:00 PM</p>
              <p>Check-out: 11:00 AM</p>
            </div>
            <div>
              <p className="uppercase tracking-widest font-bold text-[#F9F7F4] mb-4 text-xs">{dict.footer.follow}</p>
              <div className="flex gap-6">
                <a href="https://www.instagram.com/casacaballosonador/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#9B7E67] transition-transform hover:-translate-y-1 duration-300">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
                <a href="https://www.facebook.com/AlexandKelliMexico/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#9B7E67] transition-transform hover:-translate-y-1 duration-300">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Borde inferior y Copyright */}
        <div className="pt-8 border-t border-[#F9F7F4]/10 text-xs flex flex-col md:flex-row justify-between items-center text-gray-500 gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
            <p>&copy; 2026 {dict.modal.hotelName}. Made By <a href="https://thecurio.com.mx" target="_blank" rel="noopener noreferrer" className="hover:text-[#9B7E67] transition-colors">The Curio Agency</a></p>
            <a href="/politicas" className="hover:text-[#9B7E67] transition-colors underline underline-offset-4 decoration-[#F9F7F4]/10 hover:decoration-[#9B7E67]">{dict.footer.policy}</a>
          </div>
          <p className="tracking-widest uppercase text-[10px]">{dict.footer.tagline}</p>
        </div>
      </div>
    </footer>
  );
};

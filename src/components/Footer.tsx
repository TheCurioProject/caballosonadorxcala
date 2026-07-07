'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Logo } from './ui/Logo';

export default function Footer() {
  return (
    <footer className="bg-brand-black text-brand-white pt-16 pb-8 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          
          <div className="md:col-span-1 flex flex-col items-start">
            <Link href="/" aria-label="Inicio">
              <Logo className="h-12 w-auto mb-6 text-brand-white" />
            </Link>
            <p className="text-gray-400 font-serif italic text-lg mb-6">"Explore the tranquility"</p>
          </div>
          
          <div>
            <h4 className="text-lg font-serif mb-6">Contacto</h4>
            <ul className="space-y-4 text-sm text-gray-300">
              <li>13 Ecuador, 63715 Chacala, Nayarit, Mexico</li>
              <li>Reception Service: 8:00 AM to 5:00 PM Daily</li>
              <li>
                <a href="https://wa.me/message/UHSDYFMOOVTJI1" className="hover:text-white transition-colors flex items-center gap-2" target="_blank" rel="noopener noreferrer">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.124.553 4.195 1.603 6.012L.15 23.46l5.57-1.463c1.761.968 3.754 1.481 5.807 1.481 6.645 0 12.031-5.385 12.031-12.031C23.559 5.385 18.173 0 12.031 0zm.004 21.46c-1.782 0-3.528-.481-5.061-1.39l-.363-.216-3.766.989.998-3.673-.237-.376A9.975 9.975 0 0 1 2.052 12.03c0-5.509 4.484-9.994 9.994-9.994 5.51 0 9.994 4.485 9.994 9.994 0 5.51-4.484 9.995-9.994 9.995zm5.485-7.498c-.301-.151-1.781-.88-2.056-.98-.276-.1-.477-.151-.678.151-.201.301-.778.98-.953 1.18-.175.201-.351.226-.652.075-2.08-.941-3.541-2.056-4.502-3.834-.176-.301.196-.282.637-.932.126-.176.063-.326-.012-.477-.075-.151-.678-1.631-.929-2.234-.244-.588-.492-.508-.678-.517-.176-.009-.377-.009-.578-.009s-.527.075-.803.376c-.276.301-1.054 1.029-1.054 2.509s1.079 2.91 1.23 3.111c.151.201 2.121 3.238 5.138 4.542.718.311 1.278.498 1.716.637.721.229 1.378.196 1.895.119.578-.086 1.781-.728 2.032-1.431.251-.703.251-1.306.176-1.431-.075-.126-.276-.201-.577-.352z" />
                  </svg>
                  +1 250-961-2351 (WhatsApp Only)
                </a>
              </li>
              <li>
                <a href="mailto:info@hotelsonador.com" className="hover:text-white transition-colors">
                  info@hotelsonador.com
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-serif mb-6">Explorar</h4>
            <ul className="space-y-4 text-sm text-gray-300">
              <li><Link href="/" className="hover:text-white transition-colors uppercase tracking-widest text-xs">Inicio</Link></li>
              <li><Link href="/rooms" className="hover:text-white transition-colors uppercase tracking-widest text-xs">Habitaciones</Link></li>
              <li><Link href="/tours" className="hover:text-white transition-colors uppercase tracking-widest text-xs">Tours de Aventura</Link></li>
              <li><Link href="/events" className="hover:text-white transition-colors uppercase tracking-widest text-xs">Eventos</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-serif mb-6">Síguenos</h4>
            <a href="https://www.instagram.com/casacaballosonador" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-300 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
              Instagram
            </a>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="relative aspect-square">
                <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/12_footer/instagram_thumb_1.webp`} alt="Instagram 1" fill sizes="15vw" className="object-cover" />
              </div>
              <div className="relative aspect-square">
                <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/12_footer/instagram_thumb_2.webp`} alt="Instagram 2" fill sizes="15vw" className="object-cover" />
              </div>
              <div className="relative aspect-square">
                <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/12_footer/instagram_thumb_3.webp`} alt="Instagram 3" fill sizes="15vw" className="object-cover" />
              </div>
            </div>
          </div>

        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} CASA CABALLO SOÑADOR</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <Link href="/terms" className="hover:text-white transition-colors">Términos y Condiciones</Link>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-white transition-colors">
              Volver Arriba
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

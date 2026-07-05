'use client';

import React, { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, Leaf, Compass } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useDictionary } from '@/i18n/DictionaryContext';
import { usePathname, useRouter } from 'next/navigation';
import { MexicoMap } from '@/components/ui/MexicoMap';

const Footer = dynamic(() => import('@/components/home/Footer').then(mod => mod.Footer));

const TOUR_IMAGES = [
  { id: 1, imageUrl: "/imagenes/07_tours/tour_ojo_de_agua.jpg", span: "col-span-1 md:col-span-2 row-span-2" },
  { id: 2, imageUrl: "/imagenes/07_tours/tour_molote.jpg", span: "col-span-1 row-span-1" },
  { id: 3, imageUrl: "/imagenes/07_tours/tour_el_capomo.jpg", span: "col-span-1 row-span-1" },
  { id: 4, imageUrl: "/imagenes/07_tours/tour_los_cuevas.jpg", span: "col-span-1 md:col-span-2 row-span-1" },
  { id: 5, imageUrl: "/imagenes/07_tours/tour_ojo_de_agua.jpg", span: "col-span-1 row-span-1" },
  { id: 6, imageUrl: "/imagenes/07_tours/tour_molote.jpg", span: "col-span-1 row-span-1" },
  { id: 7, imageUrl: "/imagenes/07_tours/tour_el_capomo.jpg", span: "col-span-1 md:col-span-2 lg:col-span-4 row-span-2" }
];

export default function ToursPage({ params }: { params: Promise<{ lang: 'es' | 'en' | 'de' }> }) {
  const { lang } = use(params);
  const dict = useDictionary();
  const pathname = usePathname();
  const router = useRouter();
  const langPrefix = `/${lang || 'es'}`;

  const t = dict?.toursPage;
  if (!t) return null;

  const changeLanguage = (newLang: string) => {
    const segments = pathname.split('/');
    if (segments.length > 1 && ['es', 'en', 'de'].includes(segments[1])) {
      segments[1] = newLang;
    } else {
      segments.splice(1, 0, newLang);
    }
    router.push(segments.join('/') || '/');
  };

  const tours = t.tours.map((tourData: any, i: number) => ({
    ...tourData,
    imageUrl: TOUR_IMAGES[i]?.imageUrl,
    span: TOUR_IMAGES[i]?.span
  }));

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="bg-[#FAF9F6] text-[#1A1816] font-sans min-h-screen antialiased selection:bg-[#9B7E67] selection:text-[#F9F7F4]">
      
      {/* Floating Navigation (Symmetrical Grid) */}
      <nav className={`fixed top-0 w-full z-[100] transition-colors duration-500 ease-in-out pointer-events-none ${scrolled ? 'text-[#1A1816]' : 'text-[#F9F7F4]'}`}>
        <div className="py-6">
          <div className="max-w-[1400px] mx-auto px-6 md:px-16 grid grid-cols-3 items-center relative">
            
            {/* 1. Left: Minimalist Back Button */}
            <div className="flex justify-start pointer-events-auto">
              <Link 
                href={langPrefix}
                className="group flex items-center gap-3 hover:opacity-70 transition-opacity duration-300"
                aria-label={t.backToHome}
              >
                <ArrowLeft strokeWidth={1.5} className="w-5 h-5 md:w-6 md:h-6 transform group-hover:-translate-x-1 transition-transform" />
                <span className="hidden md:block uppercase tracking-[0.2em] text-xs font-bold">
                  {t.backToHome || 'INICIO'}
                </span>
              </Link>
            </div>

            {/* 2. Center: Minimalist Centered Language Switcher (Desktop) */}
            <div className="hidden md:flex justify-center pointer-events-auto">
              <div className="flex items-center gap-5">
                {['es', 'en', 'de'].map((l) => {
                  const isActive = lang === l;
                  return (
                    <button 
                      key={l}
                      onClick={() => changeLanguage(l)}
                      className={`relative flex flex-col items-center justify-center transition-all duration-300 ease-out py-1 ${
                        isActive ? 'opacity-100 grayscale-0 scale-110' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'
                      }`}
                    >
                      <span className="text-base leading-none block">{l === 'es' ? '🇲🇽' : l === 'en' ? '🇺🇸' : '🇩🇪'}</span>
                      <div className="h-1.5 mt-1 w-full flex justify-center items-center">
                        {isActive && (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className={`w-1.5 h-1.5 rounded-full ${scrolled ? 'bg-[#1A1816]' : 'bg-[#F9F7F4] shadow-[0_0_4px_rgba(0,0,0,0.6)]'}`}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Mobile spacer for grid */}
            <div className="md:hidden"></div>

            {/* 3. Right: Book Tour Action & Mobile Language Switcher */}
            <div className="flex flex-col justify-end items-end pointer-events-auto gap-2">
              <a 
                href="https://wa.me/12509612351"
                target="_blank"
                rel="noopener noreferrer"
                className="uppercase tracking-widest text-xs font-bold flex items-center gap-2 hover:opacity-70 transition-opacity"
              >
                <span className="hidden md:inline">{t.bookTour}</span>
                <span className="md:hidden">RESERVAR</span>
                <MessageCircle size={18} strokeWidth={1.5} />
              </a>
              
              <div className="flex md:hidden items-center gap-3">
                {['es', 'en', 'de'].map((l) => {
                  const isActive = lang === l;
                  return (
                    <button 
                      key={l}
                      onClick={() => changeLanguage(l)}
                      className={`relative flex flex-col items-center justify-center transition-all duration-300 ease-out py-1 ${
                        isActive ? 'opacity-100 grayscale-0 scale-110' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'
                      }`}
                    >
                      <span className="text-sm leading-none block">{l === 'es' ? '🇲🇽' : l === 'en' ? '🇺🇸' : '🇩🇪'}</span>
                      <div className="h-1 mt-1 w-full flex justify-center items-center">
                        {isActive && (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className={`w-1 h-1 rounded-full ${scrolled ? 'bg-[#1A1816]' : 'bg-[#F9F7F4] shadow-[0_0_4px_rgba(0,0,0,0.6)]'}`}
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
      </nav>

      {/* Hero Section */}
      <header className="relative w-full h-[100svh] bg-[#1A1816] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/atvhero.webp`}
            alt="ATV Tours Chacala"
            className="w-full h-full object-cover opacity-80 object-[center_30%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A1816] via-black/30 to-transparent"></div>
        </div>

        <div className="relative z-10 text-center px-6 max-w-5xl">
           <h1 className="text-white/90 uppercase tracking-[0.4em] text-xs md:text-sm font-bold mb-6 drop-shadow-lg">
             {t.heroSuperTitle}
           </h1>
           <h2 className="font-serif text-5xl md:text-6xl lg:text-[5.5rem] leading-[1.1] text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
             {t.heroTitle}
           </h2>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-32 relative z-20 bg-[#1A1816]">
        
        {/* Intro Block (Dark theme transitioning to light) */}
        <section className="max-w-4xl mx-auto px-6 py-24 md:py-32 text-center rounded-b-[4rem] bg-[#1A1816] text-[#F9F7F4]">
          <p className="font-serif text-2xl md:text-4xl leading-relaxed">
            {t.introTitle && <span className="block mb-8 font-serif italic text-[#9B7E67]">{t.introTitle}</span>}
            {t.introText1}
          </p>
        </section>

        {/* The rest of the page uses the light #FAF9F6 background */}
        <div className="bg-[#FAF9F6] pt-24 rounded-t-[4rem] -mt-12 relative z-10">

          {/* New "Experience Chacala" Intro Section & Animated Map */}
          <section className="max-w-6xl mx-auto px-8 mb-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="text-center lg:text-left order-2 lg:order-1">
                <div className="w-12 h-px bg-[#9B7E67] mx-auto lg:mx-0 mb-8 lg:mb-10"></div>
                <p className="font-light text-lg md:text-xl text-[#1A1816]/80 leading-relaxed mb-6">
                  {t.introText2}
                </p>
                <div className="w-12 h-px bg-[#9B7E67] mx-auto lg:mx-0 mt-8 lg:mt-10"></div>
              </div>
              <div className="order-1 lg:order-2 flex items-center justify-center relative w-full aspect-square lg:h-[500px]">
                <MexicoMap className="w-full h-full max-w-lg object-contain drop-shadow-xl" />
              </div>
            </div>
          </section>

          {/* 
            =========================================
            MOBILE-FIRST INDEPENDENT LAYOUT
            =========================================
          */}
          <section className="block md:hidden">
            <div className="flex flex-col">
              {tours.map((tour: any) => (
                <article key={`mobile-${tour.id}`} className="relative w-full h-[75svh] min-h-[500px] flex items-end">
                  <img 
                    src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}${tour.imageUrl}`}
                    alt={tour.title}
                    className="absolute inset-0 w-full h-full object-cover saturate-[0.8]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A1816] via-black/50 to-transparent opacity-90"></div>
                  
                  <div className="relative z-10 p-8 pb-16 w-full">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-[#9B7E67] font-serif italic text-3xl">0{tour.id}</span>
                      <div className="h-px bg-[#9B7E67]/40 flex-grow"></div>
                    </div>
                    
                    <h3 className="font-serif text-5xl mb-6 leading-none text-[#F9F7F4]">{tour.title}</h3>
                    
                    <div className="border-l border-[#9B7E67]/50 pl-5 mb-8">
                      <p className="font-light text-base text-white/90 leading-relaxed">
                        {tour.description}
                      </p>
                    </div>
                    
                    <a href="https://wa.me/12509612351" className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[#9B7E67] font-bold border border-[#9B7E67] px-6 py-3 rounded-full">
                        {t.explore} <ArrowLeft className="w-4 h-4 rotate-180" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* 
            =========================================
            DESKTOP MAGAZINE GRID LAYOUT
            =========================================
          */}
          <section className="hidden md:block max-w-[1600px] mx-auto px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[350px] gap-6">
              
              {tours.slice(0,4).map((tour: any) => (
                <article 
                  key={tour.id} 
                  className={`relative group overflow-hidden rounded-xl bg-[#1A1816] border border-[#1A1816]/5 shadow-sm hover:shadow-xl transition-all duration-700 ${tour.span}`}
                >
                  <img 
                    src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}${tour.imageUrl}`}
                    alt={tour.title}
                    className="absolute inset-0 w-full h-full object-cover transition-all duration-[2s] ease-out group-hover:scale-105 saturate-[0.7] group-hover:saturate-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-40 group-hover:opacity-90 transition-opacity duration-700"></div>
                  
                  <div className="absolute inset-0 p-8 flex flex-col justify-end pointer-events-none">
                    <div className="text-[#F9F7F4] transform translate-y-6 group-hover:translate-y-0 transition-transform duration-700 ease-[0.16,1,0.3,1]">
                      <span className="text-[#F9F7F4]/40 font-serif italic text-2xl mb-2 block tracking-wider opacity-100 group-hover:text-[#9B7E67] transition-colors duration-500">
                        {tour.id.toString().padStart(2, '0')}
                      </span>
                      <h3 className="font-serif text-3xl lg:text-4xl mb-4 leading-none tracking-wide">{tour.title}</h3>
                      <p className="font-light text-sm lg:text-base text-white/90 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100 max-w-md leading-relaxed">
                        {tour.description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}

              {/* Decorative Editorial Block */}
              <div className="col-span-2 row-span-1 bg-transparent border border-[#1A1816]/10 rounded-xl p-10 flex flex-col justify-between overflow-hidden relative group">
                <div className="absolute -right-12 -top-12 text-[#9B7E67]/10 group-hover:scale-110 transition-transform duration-[3s]">
                  <Compass size={250} strokeWidth={0.5} />
                </div>
                
                <div className="relative z-10 text-[#9B7E67] mb-4">
                  <Leaf size={32} strokeWidth={1.5} />
                </div>
                
                <div className="relative z-10 mt-auto">
                  <h4 className="font-serif text-3xl mb-4 text-[#1A1816] tracking-wide">{t.editorialTitle}</h4>
                  <p className="font-light text-base text-[#1A1816]/70 leading-relaxed max-w-md">
                    {t.editorialText}
                  </p>
                </div>
              </div>

              {tours.slice(4).map((tour: any) => (
                <article 
                  key={tour.id} 
                  className={`relative group overflow-hidden rounded-xl bg-[#1A1816] border border-[#1A1816]/5 shadow-sm hover:shadow-xl transition-all duration-700 ${tour.span}`}
                >
                  <img 
                    src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}${tour.imageUrl}`}
                    alt={tour.title}
                    className="absolute inset-0 w-full h-full object-cover transition-all duration-[2s] ease-out group-hover:scale-105 saturate-[0.7] group-hover:saturate-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-40 group-hover:opacity-90 transition-opacity duration-700"></div>
                  
                  <div className="absolute inset-0 p-8 flex flex-col justify-end pointer-events-none">
                    <div className="text-[#F9F7F4] transform translate-y-6 group-hover:translate-y-0 transition-transform duration-700 ease-[0.16,1,0.3,1]">
                      <span className="text-[#F9F7F4]/40 font-serif italic text-2xl mb-2 block tracking-wider opacity-100 group-hover:text-[#9B7E67] transition-colors duration-500">
                        {tour.id.toString().padStart(2, '0')}
                      </span>
                      <h3 className="font-serif text-3xl lg:text-4xl mb-4 leading-none tracking-wide">{tour.title}</h3>
                      <p className="font-light text-sm lg:text-base text-white/90 opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100 max-w-md leading-relaxed">
                        {tour.description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}

            </div>
          </section>

          {/* Reviews Section */}
          <section className="mt-32 max-w-7xl mx-auto px-6 pb-20">
            <div className="text-center mb-16">
              <h3 className="text-[#9B7E67] uppercase tracking-[0.3em] text-xs font-bold mb-4">{t.socialProofTitle}</h3>
              <h4 className="font-serif text-4xl md:text-5xl text-[#1A1816]">{t.socialProofSubtitle}</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {t.reviews.map((review: any) => (
                <div key={review.id} className="bg-white p-10 rounded-2xl shadow-sm border border-[#1A1816]/5 relative hover:-translate-y-2 transition-transform duration-500">
                  <div className="flex gap-1 mb-8 text-[#9B7E67]">
                    {[...Array(review.rating)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    ))}
                  </div>
                  <p className="font-light text-[#1A1816]/80 text-lg leading-relaxed mb-10 italic">
                    "{review.text}"
                  </p>
                  <div className="flex items-center gap-3 font-serif font-medium text-[#1A1816]">
                    <div className="w-8 h-8 rounded-full bg-[#1A1816] flex items-center justify-center text-white text-xs">
                      {review.author.charAt(0)}
                    </div>
                    {review.author}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
}

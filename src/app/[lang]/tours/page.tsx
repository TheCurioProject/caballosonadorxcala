'use client';

import React, { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MessageCircle, X, Clock, Users, CheckCircle2, DollarSign } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useDictionary } from '@/i18n/DictionaryContext';
import { usePathname, useRouter } from 'next/navigation';

const Footer = dynamic(() => import('@/components/home/Footer').then(mod => mod.Footer));

const TOUR_IMAGES: Record<string, string[]> = {
  "ATV_OJO_DE_AGUA": ["/imagenes/07_tours/tour_ojo_de_agua.jpg", "/imagenes/07_tours/tour_el_capomo.jpg"],
  "ATV_RIO_MOLOTE": ["/imagenes/07_tours/tour_molote.jpg", "/imagenes/07_tours/tour_los_cuevas.jpg"],
  "ATV_EL_CAPOMO": ["/imagenes/07_tours/tour_el_capomo.jpg", "/imagenes/07_tours/tour_ojo_de_agua.jpg"],
  "ATV_LAS_CUEVAS": ["/imagenes/07_tours/tour_los_cuevas.jpg", "/imagenes/07_tours/tour_molote.jpg"],
  "ATV_JUMURRCA": ["/imagenes/07_tours/tour_ojo_de_agua.jpg"], // Placeholder
  "ATV_ALTA_VISTA": ["/imagenes/07_tours/tour_el_capomo.jpg"], // Placeholder
  "ATV_VOLCANO": ["/imagenes/07_tours/tour_molote.jpg"] // Placeholder
};

export default function ToursPage({ params }: { params: Promise<{ lang: 'es' | 'en' }> }) {
  const { lang } = use(params);
  const dict = useDictionary();
  const pathname = usePathname();
  const router = useRouter();
  const langPrefix = `/${lang || 'es'}`;

  const [prices, setPrices] = useState<Record<string, number>>({});
  const [selectedTour, setSelectedTour] = useState<any | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const t = dict?.toursPage;
  
  useEffect(() => {
    // Fetch prices from DB
    const fetchPrices = async () => {
      try {
        const res = await fetch('/api/admin/addons');
        if (res.ok) {
          const data = await res.json();
          const priceMap: Record<string, number> = {};
          data.forEach((item: any) => {
            priceMap[item.type] = item.price;
          });
          setPrices(priceMap);
        }
      } catch (error) {
        console.error('Failed to fetch prices', error);
      }
    };
    fetchPrices();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!t) return null;

  const changeLanguage = (newLang: string) => {
    const segments = pathname.split('/');
    if (segments.length > 1 && ['es', 'en'].includes(segments[1])) {
      segments[1] = newLang;
    } else {
      segments.splice(1, 0, newLang);
    }
    router.push(segments.join('/') || '/');
  };

  const openModal = (tour: any) => {
    setSelectedTour(tour);
    setActiveImageIndex(0);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setSelectedTour(null);
    document.body.style.overflow = '';
  };

  const tours = t.tours.map((tourData: any) => ({
    ...tourData,
    images: TOUR_IMAGES[tourData.type] || [TOUR_IMAGES["ATV_OJO_DE_AGUA"][0]],
    price: prices[tourData.type] || 0
  }));

  return (
    <div className="bg-[#FAF9F6] text-[#1A1816] font-sans min-h-screen antialiased selection:bg-[#9B7E67] selection:text-[#F9F7F4]">
      
      {/* Floating Navigation */}
      <nav className={`fixed top-0 w-full z-[100] transition-colors duration-500 ease-in-out pointer-events-none ${scrolled ? 'text-[#1A1816]' : 'text-[#F9F7F4]'}`}>
        <div className="py-6">
          <div className="max-w-[1400px] mx-auto px-6 md:px-16 grid grid-cols-3 items-center relative">
            
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

            <div className="hidden md:flex justify-center pointer-events-auto">
              <div className="flex items-center gap-5">
                {['es', 'en'].map((l) => {
                  const isActive = lang === l;
                  return (
                    <button 
                      key={l}
                      onClick={() => changeLanguage(l)}
                      className={`relative flex flex-col items-center justify-center transition-all duration-300 ease-out py-1 ${
                        isActive ? 'opacity-100 grayscale-0 scale-110' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'
                      }`}
                    >
                      <span className="text-base leading-none block">{l === 'es' ? '🇲🇽' : '🇺🇸'}</span>
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
            
            <div className="md:hidden"></div>

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
                {['es', 'en'].map((l) => {
                  const isActive = lang === l;
                  return (
                    <button 
                      key={l}
                      onClick={() => changeLanguage(l)}
                      className={`relative flex flex-col items-center justify-center transition-all duration-300 ease-out py-1 ${
                        isActive ? 'opacity-100 grayscale-0 scale-110' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'
                      }`}
                    >
                      <span className="text-sm leading-none block">{l === 'es' ? '🇲🇽' : '🇺🇸'}</span>
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
      <header className="relative w-full h-[85svh] bg-[#1A1816] flex items-center justify-center overflow-hidden">
        <motion.div 
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute inset-0 z-0"
        >
          <img 
            src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/atvhero.webp`}
            alt="ATV Tours Chacala"
            className="w-full h-full object-cover opacity-70 object-[center_30%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#FAF9F6] via-transparent to-transparent opacity-100"></div>
          <div className="absolute inset-0 bg-black/20"></div>
        </motion.div>

        <div className="relative z-10 text-center px-6 max-w-4xl pt-24">
           <motion.h1 
             initial={{ y: 20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ delay: 0.3, duration: 0.8 }}
             className="text-white/90 uppercase tracking-[0.4em] text-xs md:text-sm font-bold mb-6 drop-shadow-lg"
           >
             {t.heroSuperTitle}
           </motion.h1>
           <motion.h2 
             initial={{ y: 30, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ delay: 0.5, duration: 1 }}
             className="font-serif text-5xl md:text-7xl lg:text-[6rem] leading-[1.05] text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
           >
             {t.heroTitle}
           </motion.h2>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-32 relative z-20 bg-[#FAF9F6] -mt-16 rounded-t-[3rem] shadow-[0_-20px_40px_rgba(0,0,0,0.05)] pt-20">
        
        {/* Intro Block */}
        <section className="max-w-3xl mx-auto px-6 py-12 md:py-16 text-center text-[#1A1816]">
          <h3 className="font-serif italic text-[#9B7E67] text-3xl md:text-4xl mb-8">{t.introTitle}</h3>
          <p className="font-light text-lg md:text-xl leading-relaxed mb-6">
            {t.introText1}
          </p>
          <p className="font-light text-lg md:text-xl leading-relaxed opacity-80">
            {t.introText2}
          </p>
        </section>

        {/* Editorial Zigzag Grid */}
        <section className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-20 py-16">
          <div className="flex flex-col gap-24 md:gap-32">
            {tours.map((tour: any, index: number) => {
              const isEven = index % 2 === 0;
              return (
                <motion.article 
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  key={tour.id} 
                  className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-10 md:gap-16 group`}
                >
                  
                  {/* Image Block */}
                  <div className="w-full md:w-1/2 overflow-hidden rounded-2xl relative aspect-[4/5] md:aspect-[3/4]">
                    <div className="absolute inset-0 bg-[#9B7E67]/10 group-hover:bg-transparent transition-colors duration-500 z-10 pointer-events-none"></div>
                    <img 
                      src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}${tour.images[0]}`}
                      alt={tour.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] ease-out group-hover:scale-105"
                    />
                  </div>

                  {/* Text Block */}
                  <div className="w-full md:w-1/2 flex flex-col justify-center">
                    <div className="flex items-center gap-4 mb-6">
                      <span className="text-[#9B7E67] font-serif italic text-3xl md:text-5xl opacity-50">
                        {tour.id.toString().padStart(2, '0')}
                      </span>
                      <div className="h-px bg-[#1A1816]/10 flex-grow"></div>
                    </div>
                    
                    <h3 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight text-[#1A1816]">
                      {tour.title}
                    </h3>
                    
                    <p className="font-light text-lg text-[#1A1816]/80 leading-relaxed mb-10 max-w-xl">
                      {tour.description}
                    </p>

                    <div className="flex items-center gap-6 text-[#1A1816]/60 mb-10 text-sm tracking-widest uppercase font-bold">
                      <div className="flex items-center gap-2">
                        <Clock size={16} />
                        <span>{tour.duration}</span>
                      </div>
                      {tour.price > 0 && (
                        <div className="flex items-center gap-2">
                          <DollarSign size={16} />
                          <span>${tour.price} USD</span>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <button 
                        onClick={() => openModal(tour)}
                        className="inline-flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-[#F9F7F4] font-bold bg-[#1A1816] px-8 py-4 rounded-full hover:bg-[#9B7E67] transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1"
                      >
                        {tour.learnMoreBtn} <ArrowLeft className="w-4 h-4 rotate-180" />
                      </button>
                    </div>
                  </div>

                </motion.article>
              );
            })}
          </div>
        </section>

        {/* Reviews Section */}
        <section className="mt-20 max-w-6xl mx-auto px-6 pb-20">
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

      </main>

      <Footer />

      {/* Editorial Modal (Framer Motion) */}
      <AnimatePresence>
        {selectedTour && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 md:p-12"
          >
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeModal}
            ></div>

            {/* Modal Container */}
            <motion.div 
              initial={{ y: 50, scale: 0.95, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 20, scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.5, type: 'spring', bounce: 0.3 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-[#FAF9F6] rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
            >
              
              {/* Close Button */}
              <button 
                onClick={closeModal}
                className="absolute top-4 right-4 z-50 w-10 h-10 bg-white/20 hover:bg-white backdrop-blur-md rounded-full flex items-center justify-center text-[#1A1816] transition-all shadow-sm"
              >
                <X size={20} strokeWidth={2} />
              </button>

              {/* Left/Top: Image Carousel */}
              <div className="w-full md:w-5/12 h-64 md:h-auto relative bg-[#1A1816] overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.img 
                    key={activeImageIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}${selectedTour.images[activeImageIndex]}`}
                    alt={selectedTour.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </AnimatePresence>
                
                {/* Carousel controls */}
                {selectedTour.images.length > 1 && (
                  <div className="absolute bottom-4 left-0 w-full flex justify-center gap-2 z-10">
                    {selectedTour.images.map((_: any, idx: number) => (
                      <button 
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${idx === activeImageIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/80'}`}
                      />
                    ))}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
              </div>

              {/* Right/Bottom: Content */}
              <div className="w-full md:w-7/12 p-8 md:p-12 overflow-y-auto">
                <span className="text-[#9B7E67] uppercase tracking-[0.2em] text-xs font-bold mb-2 block">
                  {t.editorialTitle || "Chacala Adventure"}
                </span>
                <h2 className="font-serif text-4xl md:text-5xl text-[#1A1816] mb-6 leading-tight">
                  {selectedTour.title}
                </h2>
                
                {/* Stats Row */}
                <div className="flex flex-wrap gap-4 mb-8">
                  <div className="bg-white border border-[#1A1816]/10 rounded-xl p-4 flex-1 min-w-[120px]">
                    <Clock size={20} className="text-[#9B7E67] mb-2" />
                    <span className="block text-[10px] uppercase tracking-widest text-[#1A1816]/50 font-bold mb-1">{t.modal.duration}</span>
                    <span className="font-medium text-[#1A1816]">{selectedTour.duration}</span>
                  </div>
                  {selectedTour.price > 0 && (
                    <div className="bg-white border border-[#1A1816]/10 rounded-xl p-4 flex-1 min-w-[120px]">
                      <DollarSign size={20} className="text-[#9B7E67] mb-2" />
                      <span className="block text-[10px] uppercase tracking-widest text-[#1A1816]/50 font-bold mb-1">{t.modal.price}</span>
                      <span className="font-medium text-[#1A1816]">${selectedTour.price} USD</span>
                    </div>
                  )}
                  <div className="bg-white border border-[#1A1816]/10 rounded-xl p-4 flex-1 min-w-[120px]">
                    <Users size={20} className="text-[#9B7E67] mb-2" />
                    <span className="block text-[10px] uppercase tracking-widest text-[#1A1816]/50 font-bold mb-1">{t.modal.capacity}</span>
                    <span className="font-medium text-[#1A1816] text-xs leading-tight">{selectedTour.capacity}</span>
                  </div>
                </div>

                <div className="h-px bg-[#1A1816]/10 w-full mb-8"></div>

                <h4 className="font-serif text-xl mb-4 text-[#1A1816]">Acerca del Recorrido</h4>
                <p className="font-light text-[#1A1816]/80 leading-relaxed mb-8">
                  {selectedTour.longDescription}
                </p>

                <h4 className="font-serif text-xl mb-4 text-[#1A1816]">{t.modal.includes}</h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
                  {selectedTour.includes.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm font-light text-[#1A1816]/80">
                      <CheckCircle2 size={16} className="text-[#9B7E67] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <a 
                  href={`https://wa.me/12509612351?text=${encodeURIComponent(t.modal.whatsappMessage + ' ' + selectedTour.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex justify-center items-center gap-3 text-xs uppercase tracking-[0.2em] text-white font-bold bg-[#9B7E67] px-8 py-5 rounded-xl hover:bg-[#1A1816] transition-colors duration-300"
                >
                  <MessageCircle size={18} /> {t.modal.bookNow}
                </a>

              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

'use client';

import React, { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import { ArrowLeft, X, Clock, Users, CheckCircle2, DollarSign, Compass, ShieldCheck, Backpack, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useDictionary } from '@/i18n/DictionaryContext';
import { usePathname, useRouter } from 'next/navigation';
import { ActionLoadingScreen } from '@/components/ui/ActionLoadingScreen';
import { useBooking } from '@/context/BookingContext';

const Footer = dynamic(() => import('@/components/home/Footer').then(mod => mod.Footer));

const TOUR_IMAGES: Record<string, string[]> = {
  "ATV_OJO_DE_AGUA": [
    "/tours_gallery/01_ojo_de_agua/00_ojoagua_002.webp",
    "/tours_gallery/01_ojo_de_agua/01_ojoagua_001.webp",
    "/tours_gallery/01_ojo_de_agua/02_ojoagua_012.webp",
    "/tours_gallery/01_ojo_de_agua/03_ojoagua_003.webp",
    "/tours_gallery/01_ojo_de_agua/04_ojoagua_015.webp",
    "/tours_gallery/01_ojo_de_agua/05_ojoagua_014.webp",
    "/tours_gallery/01_ojo_de_agua/06_ojoagua_004.webp",
    "/tours_gallery/01_ojo_de_agua/07_ojoagua_005.webp",
    "/tours_gallery/01_ojo_de_agua/08_ojoagua_008.webp"
  ],
  "ATV_RIO_MOLOTE": [
    "/tours_gallery/02_molote_river/00_molote_002.webp",
    "/tours_gallery/02_molote_river/01_molote_001.webp",
    "/tours_gallery/02_molote_river/02_molote_003.webp",
    "/tours_gallery/02_molote_river/03_molote_004.webp",
    "/tours_gallery/02_molote_river/04_molote_005.webp",
    "/tours_gallery/02_molote_river/05_molote_006.webp",
    "/tours_gallery/02_molote_river/06_molote_007.webp",
    "/tours_gallery/02_molote_river/07_molote_008.webp",
    "/tours_gallery/02_molote_river/08_molote_010.webp"
  ],
  "ATV_EL_CAPOMO": [
    "/tours_gallery/03_el_capomo/00_capomof001.webp",
    "/tours_gallery/03_el_capomo/01_capomof003.webp",
    "/tours_gallery/03_el_capomo/02_capomof002.webp",
    "/tours_gallery/03_el_capomo/03_capomof008.webp",
    "/tours_gallery/03_el_capomo/04_capomof006.webp",
    "/tours_gallery/03_el_capomo/05_capomof005.webp",
    "/tours_gallery/03_el_capomo/06_capomof011.webp",
    "/tours_gallery/03_el_capomo/07_capomof010.webp",
    "/tours_gallery/03_el_capomo/08_capomof009.webp",
    "/tours_gallery/03_el_capomo/09_capomof004.webp"
  ],
  "ATV_LAS_CUEVAS": [
    "/tours_gallery/04_las_cuevas/01_loscuevas016.webp",
    "/tours_gallery/04_las_cuevas/02_loscuevas005.webp",
    "/tours_gallery/04_las_cuevas/03_loscuevas002.webp",
    "/tours_gallery/04_las_cuevas/04_loscuevas012.webp",
    "/tours_gallery/04_las_cuevas/05_loscuevas014.webp",
    "/tours_gallery/04_las_cuevas/06_loscuevas010.webp",
    "/tours_gallery/04_las_cuevas/07_loscuevas009.webp",
    "/tours_gallery/04_las_cuevas/08_loscuevas007.webp",
    "/tours_gallery/04_las_cuevas/09_loscuevas003.webp"
  ],
  "ATV_JUMURRCA": [
    "/tours_gallery/05_jamurrca/00_jumurrca001.webp",
    "/tours_gallery/05_jamurrca/01_jumurrca002.webp",
    "/tours_gallery/05_jamurrca/02_jumurrca006.webp",
    "/tours_gallery/05_jamurrca/03_jumurrca008.webp",
    "/tours_gallery/05_jamurrca/04_jumurrca004.webp",
    "/tours_gallery/05_jamurrca/05_jumurrca005.webp",
    "/tours_gallery/05_jamurrca/06_jumurrca007.webp",
    "/tours_gallery/05_jamurrca/07_jumurrca009.webp",
    "/tours_gallery/05_jamurrca/08_jumurrca003.webp"
  ],
  "ATV_ALTA_VISTA": [
    "/tours_gallery/06_alta_vista/00_altavista_002.webp",
    "/tours_gallery/06_alta_vista/01_altavista_010.webp",
    "/tours_gallery/06_alta_vista/02_altavista_004.webp",
    "/tours_gallery/06_alta_vista/03_altavista_005.webp",
    "/tours_gallery/06_alta_vista/04_altavista_007.webp",
    "/tours_gallery/06_alta_vista/05_altavista_006.webp",
    "/tours_gallery/06_alta_vista/06_altavista_001.webp",
    "/tours_gallery/06_alta_vista/07_altavista_003.webp",
    "/tours_gallery/06_alta_vista/08_alta_vista009.webp"
  ],
  "ATV_VOLCANO": [
    "/tours_gallery/07_volcano/00_sunset_019.webp",
    "/tours_gallery/07_volcano/01_sunset_006.webp",
    "/tours_gallery/07_volcano/02_sunset_008.webp",
    "/tours_gallery/07_volcano/03_sunset_015.webp",
    "/tours_gallery/07_volcano/04_sunset_017.webp",
    "/tours_gallery/07_volcano/05_sunset_005.webp",
    "/tours_gallery/07_volcano/06_sunset_011.webp",
    "/tours_gallery/07_volcano/07_sunset_016.webp",
    "/tours_gallery/07_volcano/08_sunset_009.webp"
  ]
};

import { getImageUrl } from '@/lib/siteImages';

export default function ToursClient({ lang, siteImages }: { lang: 'es' | 'en', siteImages: any }) {
  const dict = useDictionary();
  const pathname = usePathname();
  const router = useRouter();
  const langPrefix = `/${lang || 'es'}`;
  const formatPrice = (amountInMxn: number) => `$${Math.round(amountInMxn)} MXN`;

  const [prices, setPrices] = useState<Record<string, number>>({});
  const [selectedTour, setSelectedTour] = useState<any | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const { openBookingModal } = useBooking();

  const t = dict?.toursPage;
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 400]);
  const y2 = useTransform(scrollY, [0, 1000], [0, 200]);
  const opacity = useTransform(scrollY, [0, 600], [1, 0]);
  const willChange = useTransform(scrollY, (v) => v < 1000 ? "transform" : "auto");
  
  useEffect(() => {
    const abortController = new AbortController();
    // Fetch prices from DB (using the new tours API instead of addons)
    const fetchPrices = async () => {
      try {
        const res = await fetch('/api/admin/tours', { signal: abortController.signal });
        if (res.ok) {
          const data = await res.json();
          const priceMap: Record<string, number> = {};
          data.forEach((item: any) => {
            if (item.name) {
              // Normalize name for robust matching
              priceMap[item.name.toLowerCase().trim()] = item.pricePerPax;
            }
          });
          setPrices(priceMap);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('Failed to fetch prices', error);
      }
    };
    fetchPrices();
    return () => abortController.abort();
  }, []);


  useEffect(() => {
    if (!selectedTour || selectedTour.images.length <= 1 || isFullscreen) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActiveImageIndex((prev) => (prev + 1) % selectedTour.images.length);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedTour, isFullscreen]);

  if (!t) return null;


  const openModal = (tour: any) => {
    setSelectedTour(tour);
    setActiveImageIndex(0);
    setIsFullscreen(false);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setSelectedTour(null);
    setIsFullscreen(false);
    document.body.style.overflow = '';
  };

  const handleNextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedTour) {
      setActiveImageIndex((prev) => (prev + 1) % selectedTour.images.length);
    }
  };

  const handlePrevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (selectedTour) {
      setActiveImageIndex((prev) => (prev - 1 + selectedTour.images.length) % selectedTour.images.length);
    }
  };

  const getTourPrice = (tourData: any) => {
    const title = tourData.title?.toLowerCase().trim();
    if (title && prices[title] !== undefined) return prices[title];

    // Fallbacks based on tour type to map across translations
    const fallbacks: Record<string, string[]> = {
      "ATV_VOLCANO": ["volcano sunset", "volcán", "volcan"],
      "ATV_OJO_DE_AGUA": ["ojo de agua"],
      "ATV_RIO_MOLOTE": ["río molote", "rio molote"],
      "ATV_EL_CAPOMO": ["el capomo"],
      "ATV_LAS_CUEVAS": ["las cuevas"],
      "ATV_JUMURRCA": ["jumurrca"],
      "ATV_ALTA_VISTA": ["alta vista"]
    };

    const aliases = fallbacks[tourData.type] || [];
    for (const alias of aliases) {
      if (prices[alias] !== undefined) return prices[alias];
    }
    
    return 0;
  };

  const tours = t.tours.map((tourData: any) => {
    const rawImages = TOUR_IMAGES[tourData.type] || [TOUR_IMAGES["ATV_OJO_DE_AGUA"][0]];
    return {
      ...tourData,
      images: rawImages.map(img => (siteImages && siteImages[img] && siteImages[img].url) ? siteImages[img].url : img),
      price: getTourPrice(tourData)
    };
  });

  return (
    <div className="bg-[#0A0908] text-[#F9F7F4] font-sans min-h-screen antialiased selection:bg-[#9B7E67] selection:text-[#0A0908]">
      <ActionLoadingScreen isOpen={isNavigating} theme="dark" subMessage={lang === 'en' ? 'ONE MOMENT PLEASE...' : 'UN MOMENTO POR FAVOR...'} />
      
      {/* Floating Navigation */}
      <nav className="fixed top-0 w-full z-[100] bg-transparent text-[#F9F7F4] pointer-events-none">
        <div className="py-5 md:py-6">
          <div className="max-w-[1400px] mx-auto px-6 md:px-16 grid grid-cols-3 items-center relative">
            
            <div className="flex justify-start pointer-events-auto">
              <Link 
                href={langPrefix}
                onClick={(e) => {
                  e.preventDefault();
                  setIsNavigating(true);
                  setTimeout(() => {
                    router.push(langPrefix);
                  }, 100);
                }}
                className="group flex items-center gap-3 hover:opacity-70 transition-opacity duration-300"
                aria-label={lang === 'en' ? 'BACK TO HOME' : 'VOLVER AL INICIO'}
              >
                <ArrowLeft strokeWidth={1.5} className="w-5 h-5 md:w-6 md:h-6 transform group-hover:-translate-x-1 transition-transform" />
                <span className="hidden md:block uppercase tracking-[0.2em] text-sm md:text-base font-bold text-[#F9F7F4]">
                  {lang === 'en' ? 'HOME' : 'INICIO'}
                </span>
              </Link>
            </div>

            <div className="hidden md:flex justify-center pointer-events-auto">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {['es', 'en'].map((l) => {
                    const isActive = lang === l;
                    
                    // Construct new path
                    const segments = pathname.split('/');
                    if (segments.length > 1 && ['es', 'en'].includes(segments[1])) {
                      segments[1] = l;
                    } else {
                      segments.splice(1, 0, l);
                    }
                    const newPath = segments.join('/') || '/';

                    return (
                      <Link 
                        key={l}
                        href={newPath}
                        prefetch={true}
                        className={`relative flex flex-col items-center justify-center transition-all duration-300 ease-out py-1 ${
                          isActive ? 'opacity-100 scale-110 font-bold' : 'opacity-40 hover:opacity-100 font-medium'
                        }`}
                      >
                        <span className="text-base md:text-lg md:text-base leading-none block tracking-widest">{l.toUpperCase()}</span>
                        <div className="h-1.5 mt-1 w-full flex justify-center items-center">
                          {isActive && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ duration: 0.2 }}
                              className="w-1.5 h-1.5 rounded-full bg-[#9B7E67] shadow-sm"
                            />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>


              </div>
            </div>
            
            <div className="md:hidden"></div>

            <div className="flex flex-col justify-end items-end pointer-events-auto gap-2 relative">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => openBookingModal()}
                  className="whitespace-nowrap uppercase tracking-widest text-[10px] md:text-xs font-bold border rounded-full px-4 py-1.5 hover:opacity-70 transition-all border-[#F9F7F4] text-[#F9F7F4]"
                >
                  <span className="hidden md:inline">{lang === 'en' ? 'Book Now' : 'Reservar Ahora'}</span>
                  <span className="md:hidden">{lang === 'en' ? 'Book Now' : 'Reservar Ahora'}</span>
                </button>
              </div>
              
              <div className="flex md:hidden items-center gap-2 absolute top-full right-0 mt-2">
                <div className="flex items-center gap-1">
                  {['es', 'en'].map((l) => {
                    const isActive = lang === l;
                    
                    // Construct new path
                    const segments = pathname.split('/');
                    if (segments.length > 1 && ['es', 'en'].includes(segments[1])) {
                      segments[1] = l;
                    } else {
                      segments.splice(1, 0, l);
                    }
                    const newPath = segments.join('/') || '/';

                    return (
                      <Link 
                        key={l}
                        href={newPath}
                        prefetch={true}
                        className={`relative flex flex-col items-center justify-center transition-all duration-300 ease-out py-1 px-1 ${
                          isActive ? 'opacity-100 scale-110 font-bold' : 'opacity-40 hover:opacity-100 font-medium'
                        }`}
                      >
                        <span className="text-[11px] leading-none block tracking-widest">{l.toUpperCase()}</span>
                        <div className="h-1 mt-1 w-full flex justify-center items-center">
                          {isActive && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ duration: 0.2 }}
                              className="w-1 h-1 rounded-full bg-[#9B7E67] shadow-sm"
                            />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>


              </div>
            </div>

          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative w-full h-screen bg-[#0A0908] flex items-center justify-center overflow-hidden border-b border-white/5">
        <motion.div 
          style={{ y: y1, willChange }}
          className="absolute inset-0 z-0 transform-gpu origin-top"
        >
          <Image 
            src={getImageUrl('/imagenes/07_tours/atvhero.webp', siteImages)}
            alt="ATV Tours Chacala"
            fill
            sizes="100vw"
            className="object-cover opacity-60 object-[center_30%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0908] via-black/20 to-black/60 opacity-100"></div>
        </motion.div>

        <motion.div 
          style={{ y: y2, opacity, willChange }}
          className="relative z-10 text-center px-4 md:px-6 max-w-5xl pt-32 md:pt-40 transform-gpu"
        >
           <motion.h1 
             initial={{ y: 20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ delay: 0.3, duration: 0.8 }}
             className="text-[#9B7E67] uppercase tracking-[0.4em] text-[10px] md:text-xs font-bold mb-6 drop-shadow-lg"
           >
             {t.heroSuperTitle}
           </motion.h1>
           <motion.h2 
             initial={{ y: 30, opacity: 0, scale: 0.95 }}
             animate={{ y: 0, opacity: 1, scale: 1 }}
             transition={{ delay: 0.5, duration: 1.2, ease: "easeOut" }}
             className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-[4.5rem] leading-[1.1] text-[#F9F7F4] drop-shadow-xl"
           >
             {t.heroTitle}
           </motion.h2>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 opacity-70"
        >
          <span className="text-[#9B7E67] uppercase tracking-[0.3em] text-[8px] font-bold">{t.scroll}</span>
          <div className="w-[1px] h-8 md:h-12 bg-white/10 relative overflow-hidden">
            <motion.div 
              animate={{ y: ["-100%", "100%"] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute inset-0 w-full h-full bg-[#9B7E67]"
            />
          </div>
        </motion.div>
      </header>

      {/* Main Content */}
      <main className="relative z-20 bg-[#0A0908] pt-20 pb-32">
        
        {/* Intro Block */}
        <section className="max-w-4xl mx-auto px-6 py-16 md:py-24 text-center">
          <h3 className="font-serif italic text-[#9B7E67] text-3xl md:text-5xl mb-10">{t.introTitle}</h3>
          <p className="font-light text-lg md:text-2xl leading-relaxed text-[#F9F7F4]/90">
            {t.introText1}
          </p>
        </section>

        {/* Tour Information Grid */}
        <section className="max-w-7xl mx-auto px-6 pb-24 md:pb-32">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* Custom Tours */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.8 }}
              className="bg-[#131110] p-10 rounded-[2rem] border border-white/5 hover:border-[#9B7E67]/30 transition-colors duration-500 group"
            >
              <div className="w-14 h-14 bg-[#9B7E67]/10 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-[#9B7E67]/20 transition-all duration-500">
                <Compass className="text-[#9B7E67]" size={24} />
              </div>
              <h4 className="font-serif text-2xl text-[#F9F7F4] mb-4">{t.infoCustomToursTitle}</h4>
              <p className="font-light text-[#F9F7F4]/60 leading-relaxed text-base md:text-lg">
                {t.infoCustomToursText}
              </p>
            </motion.div>

            {/* The Vehicles */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="bg-[#131110] p-10 rounded-[2rem] border border-white/5 hover:border-[#9B7E67]/30 transition-colors duration-500 group"
            >
              <div className="w-14 h-14 bg-[#9B7E67]/10 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-[#9B7E67]/20 transition-all duration-500">
                <ShieldCheck className="text-[#9B7E67]" size={24} />
              </div>
              <h4 className="font-serif text-2xl text-[#F9F7F4] mb-4">{t.infoVehiclesTitle}</h4>
              <p className="font-light text-[#F9F7F4]/60 leading-relaxed text-base md:text-lg">
                {t.infoVehiclesText}
              </p>
            </motion.div>

            {/* What to Bring */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="bg-[#131110] p-10 rounded-[2rem] border border-white/5 hover:border-[#9B7E67]/30 transition-colors duration-500 group"
            >
              <div className="w-14 h-14 bg-[#9B7E67]/10 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-[#9B7E67]/20 transition-all duration-500">
                <Backpack className="text-[#9B7E67]" size={24} />
              </div>
              <h4 className="font-serif text-2xl text-[#F9F7F4] mb-5">{t.infoBringTitle}</h4>
              <ul className="space-y-4">
                {t.infoBringItems && t.infoBringItems.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="text-[#9B7E67] shrink-0 mt-0.5" size={16} />
                    <span className="font-light text-[#F9F7F4]/70 text-base md:text-lg leading-tight">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Private Tours WhatsApp */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="bg-[#131110] p-10 rounded-[2rem] border border-white/5 hover:border-[#25D366]/50 transition-colors duration-500 group cursor-pointer"
              onClick={() => window.open(`https://wa.me/12509612351?text=${encodeURIComponent(lang === 'en' ? 'Hello, I am interested in a private tour during my stay at Hotel Soñador.' : 'Hola, me interesa un tour privado durante mi estancia en Hotel Soñador.')}`, '_blank')}
            >
              <div className="w-14 h-14 bg-[#25D366]/10 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-[#25D366]/20 transition-all duration-500">
                <svg className="text-[#25D366] w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                </svg>
              </div>
              <h4 className="font-serif text-2xl text-[#F9F7F4] mb-4">{lang === 'en' ? 'Private Tours' : 'Tour Privado'}</h4>
              <p className="font-light text-[#F9F7F4]/60 leading-relaxed text-base md:text-lg">
                {lang === 'en' ? (
                  <>Staying in Chacala but not with us?<br />Contact us directly via WhatsApp for availability to reserve your tour.</>
                ) : (
                  <>¿Te hospedas en Chacala pero no con nosotros?<br />Contáctanos directamente vía WhatsApp para consultar disponibilidad y reservar tu tour.</>
                )}
              </p>
              <div className="mt-8">
                <span className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full border border-[#25D366] text-[#25D366] font-bold uppercase tracking-widest text-sm transition-all duration-300 group-hover:bg-[#25D366] group-hover:text-[#131110]">
                  WhatsApp
                </span>
              </div>
            </motion.div>

          </div>
        </section>

        {/* Editorial Zigzag Grid */}
        <section className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-20 pb-24">
          <div className="flex flex-col gap-32 md:gap-40">
            {tours.map((tour: any, index: number) => {
              const isEven = index % 2 === 0;
              return (
                <motion.article 
                  initial={{ opacity: 0, y: 80 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  key={tour.id} 
                  className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-12 md:gap-20 group`}
                >
                  
                  {/* Image Block */}
                  <div className="w-full md:w-1/2 overflow-hidden rounded-3xl relative aspect-[4/5] md:aspect-[3/4] shadow-2xl shadow-black/50 border border-white/5">
                    <div className="absolute inset-0 bg-[#9B7E67]/20 group-hover:bg-transparent transition-colors duration-700 z-10 pointer-events-none mix-blend-overlay"></div>
                    <Image 
                      src={tour.images[0]}
                      alt={tour.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-[3s] ease-out group-hover:scale-110 filter brightness-90 group-hover:brightness-100"
                    />
                  </div>

                  {/* Text Block */}
                  <div className="w-full md:w-1/2 flex flex-col justify-center">
                    <div className="flex items-center gap-6 mb-8">
                      <span className="text-[#9B7E67] font-serif italic text-4xl md:text-6xl opacity-40">
                        {tour.id.toString().padStart(2, '0')}
                      </span>
                      <div className="h-px bg-white/10 flex-grow"></div>
                    </div>
                    
                    <h3 className="font-serif text-5xl md:text-6xl lg:text-[4.5rem] mb-8 leading-[1.1] text-[#F9F7F4]">
                      {tour.title}
                    </h3>
                    
                    <p className="font-light text-xl md:text-2xl text-[#F9F7F4]/60 leading-relaxed mb-12 max-w-xl">
                      {tour.description}
                    </p>

                    <div className="flex items-center gap-8 text-[#9B7E67] mb-12 text-base md:text-lg tracking-widest uppercase font-bold">
                      <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                        <Clock size={16} />
                        <span>{tour.duration}</span>
                      </div>
                      {tour.price > 0 && (
                        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                          <DollarSign size={16} />
                          <span>{formatPrice(tour.price)} {lang === 'en' ? 'per person' : 'por persona'}</span>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <button 
                        onClick={() => openModal(tour)}
                        className="inline-flex items-center gap-4 text-sm md:text-base uppercase tracking-[0.2em] text-[#0A0908] font-bold bg-[#9B7E67] px-10 py-5 rounded-full hover:bg-[#F9F7F4] transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-white/10 transform hover:-translate-y-1"
                      >
                        {lang === 'en' ? 'Learn More' : 'Saber Más'} <ArrowLeft className="w-4 h-4 rotate-180" />
                      </button>
                    </div>
                  </div>

                </motion.article>
              );
            })}
          </div>
        </section>

        {/* Reviews Section */}
        <section className="mt-32 max-w-7xl mx-auto px-6 pb-20">
          <div className="text-center mb-20">
            <h3 className="text-[#9B7E67] uppercase tracking-[0.4em] text-[10px] font-bold mb-6">{t.socialProofTitle}</h3>
            <h4 className="font-serif text-5xl md:text-6xl text-[#F9F7F4]">{t.socialProofSubtitle}</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {t.reviews.map((review: any) => (
              <div key={review.id} className="bg-[#131110] p-10 md:p-12 rounded-[2rem] shadow-xl shadow-black/40 border border-white/5 relative hover:-translate-y-3 transition-transform duration-500">
                <div className="flex gap-1 mb-8 text-[#9B7E67]">
                  {[...Array(review.rating)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  ))}
                </div>
                <p className="font-light text-[#F9F7F4]/70 text-xl md:text-2xl leading-relaxed mb-10 italic">
                  "{review.text}"
                </p>
                <div className="flex items-center gap-4 font-serif text-[#F9F7F4]">
                  <div className="w-10 h-10 rounded-full bg-[#9B7E67] flex items-center justify-center text-[#0A0908] font-bold text-base md:text-lg">
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
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={closeModal}
            ></div>

            {/* Modal Container */}
            <motion.div 
              initial={{ y: 50, scale: 0.95, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 20, scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.5, type: 'spring', bounce: 0.3 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-[#131110] rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl shadow-black/80 flex flex-col"
            >
              
              {/* Close Button */}
              <button 
                onClick={closeModal}
                className="absolute top-6 right-6 z-50 w-12 h-12 bg-black/40 hover:bg-[#9B7E67] backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all shadow-lg"
              >
                <X size={20} strokeWidth={2} />
              </button>

              {/* Left/Top: Image Carousel */}
              <div 
                className="w-full h-[40vh] min-h-[300px] relative bg-[#0A0908] overflow-hidden group cursor-pointer shrink-0"
              >
                {selectedTour.images.map((img: string, idx: number) => (
                  <motion.img 
                    key={img + idx}
                    onClick={() => setIsFullscreen(true)}
                    src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}${img}`}
                    alt={`${selectedTour.title} image ${idx + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ 
                      opacity: activeImageIndex === idx ? 1 : 0,
                      scale: activeImageIndex === idx ? 1 : 1.05
                    }}
                    transition={{ duration: 0.7 }}
                    style={{ pointerEvents: activeImageIndex === idx ? 'auto' : 'none', touchAction: 'pan-y' }}
                    drag={activeImageIndex === idx ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(e, { offset }) => {
                      const swipe = offset.x;
                      if (swipe < -50) {
                        handleNextImage();
                      } else if (swipe > 50) {
                        handlePrevImage();
                      }
                    }}
                  />
                ))}
                
                {/* Fullscreen icon hint */}
                <div className="absolute top-6 left-6 z-20 p-2 bg-black/40 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity border border-white/20">
                  <Maximize2 size={16} />
                </div>
                
                {/* Carousel controls */}
                {selectedTour.images.length > 1 && (
                  <div className="absolute bottom-6 left-0 w-full flex justify-center gap-3 z-10">
                    {selectedTour.images.map((_: any, idx: number) => (
                      <button 
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveImageIndex(idx);
                        }}
                        className={`h-2 rounded-full transition-all ${idx === activeImageIndex ? 'w-8 bg-[#9B7E67]' : 'w-2 bg-white/50 hover:bg-white/80'}`}
                      />
                    ))}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
              </div>

              {/* Right/Bottom: Content */}
              <div className="w-full p-8 md:p-14 overflow-y-auto overscroll-contain flex-1">
                <span className="text-[#9B7E67] uppercase tracking-[0.3em] text-[10px] font-bold mb-4 block">
                  {t.editorialTitle || "Chacala Adventure"}
                </span>
                <h2 className="font-serif text-4xl md:text-6xl text-[#F9F7F4] mb-8 leading-tight">
                  {selectedTour.title}
                </h2>
                
                {/* Stats Row */}
                <div className="flex flex-wrap gap-4 mb-10">
                  <div className="bg-[#0A0908] border border-white/5 rounded-2xl p-5 flex-1 min-w-[120px]">
                    <Clock size={20} className="text-[#9B7E67] mb-3" />
                    <span className="block text-[9px] uppercase tracking-widest text-[#F9F7F4]/40 font-bold mb-1">{t.modal.duration}</span>
                    <span className="font-medium text-[#F9F7F4] text-base md:text-lg">{selectedTour.duration}</span>
                  </div>
                  {selectedTour.price > 0 && (
                    <div className="bg-[#0A0908] border border-white/5 rounded-2xl p-5 flex-1 min-w-[120px]">
                      <DollarSign size={20} className="text-[#9B7E67] mb-3" />
                      <span className="block text-[9px] uppercase tracking-widest text-[#F9F7F4]/40 font-bold mb-1">{t.modal.price}</span>
                      <span className="font-medium text-[#F9F7F4] text-base md:text-lg">{formatPrice(selectedTour.price)} {lang === 'en' ? 'per person' : 'por persona'}</span>
                    </div>
                  )}
                  <div className="bg-[#0A0908] border border-white/5 rounded-2xl p-5 flex-1 min-w-[120px]">
                    <Users size={20} className="text-[#9B7E67] mb-3" />
                    <span className="block text-[9px] uppercase tracking-widest text-[#F9F7F4]/40 font-bold mb-1">{t.modal.capacity}</span>
                    <span className="font-medium text-[#F9F7F4] text-sm md:text-base leading-tight">{selectedTour.capacity}</span>
                  </div>
                </div>

                <div className="h-px bg-white/5 w-full mb-10"></div>

                <h4 className="font-serif text-2xl mb-5 text-[#F9F7F4]">{t.modal?.about || "Acerca del Recorrido"}</h4>
                <p className="font-light text-[#F9F7F4]/70 leading-relaxed mb-10 text-xl md:text-2xl">
                  {selectedTour.longDescription}
                </p>

                <h4 className="font-serif text-2xl mb-5 text-[#F9F7F4]">{t.modal.includes}</h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                  {selectedTour.includes.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3 text-base md:text-lg font-light text-[#F9F7F4]/70">
                      <CheckCircle2 size={18} className="text-[#9B7E67] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="w-full inline-flex justify-center items-center gap-4 text-sm md:text-base uppercase tracking-[0.2em] text-[#9B7E67] font-bold bg-[#9B7E67]/10 border border-[#9B7E67]/30 px-8 py-6 rounded-2xl text-center">
                  {lang === 'en' ? 'Reserve this tour when booking your stay' : 'Reserva este tour al reservar tu estancia'}
                </div>

              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Image Overlay */}
      <AnimatePresence>
        {isFullscreen && selectedTour && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center"
          >
            {/* Close Fullscreen */}
            <button 
              onClick={() => setIsFullscreen(false)}
              className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-colors border border-white/20"
            >
              <X size={24} />
            </button>
            
            {/* Images */}
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              {selectedTour.images.map((img: string, idx: number) => (
                <motion.div 
                  key={'fullscreen-' + img + idx}
                  className="absolute inset-0 w-full h-full flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ 
                    opacity: activeImageIndex === idx ? 1 : 0,
                    scale: activeImageIndex === idx ? 1 : 0.95
                  }}
                  transition={{ duration: 0.4 }}
                  style={{ pointerEvents: activeImageIndex === idx ? 'auto' : 'none', touchAction: 'pan-y' }}
                  drag={activeImageIndex === idx ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(e, { offset }) => {
                    const swipe = offset.x;
                    if (swipe < -50) {
                      handleNextImage();
                    } else if (swipe > 50) {
                      handlePrevImage();
                    }
                  }}
                >
                  <Image 
                    src={img}
                    alt={`${selectedTour.title} fullscreen image ${idx + 1}`}
                    fill
                    sizes="100vw"
                    className="object-contain pointer-events-none"
                  />
                </motion.div>
              ))}
              
              {/* Navigation Arrows */}
              {selectedTour.images.length > 1 && (
                <>
                  {/* Desktop Arrows */}
                  <button 
                    onClick={handlePrevImage}
                    className="hidden md:block absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-4 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all duration-300 border border-white/20 z-20"
                  >
                    <ChevronLeft size={32} />
                  </button>
                  
                  <button 
                    onClick={handleNextImage}
                    className="hidden md:block absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-4 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all duration-300 border border-white/20 z-20"
                  >
                    <ChevronRight size={32} />
                  </button>
                </>
              )}
              
              {/* Dots */}
              {selectedTour.images.length > 1 && (
                <div className="absolute bottom-8 left-0 w-full flex justify-center gap-3 z-10">
                  {selectedTour.images.map((_: any, idx: number) => (
                    <button 
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`h-2 rounded-full transition-all ${idx === activeImageIndex ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/80'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

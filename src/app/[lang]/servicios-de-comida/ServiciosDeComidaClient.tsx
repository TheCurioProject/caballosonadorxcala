'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Utensils, ArrowLeft, CheckCircle2, Coffee, Sunset } from 'lucide-react';
import Image from 'next/image';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Footer } from '@/components/home/Footer';
import { useBooking } from '@/context/BookingContext';
import { ActionLoadingScreen } from '@/components/ui/ActionLoadingScreen';

import { getImageUrl } from '@/lib/siteImages';

export default function ServiciosDeComidaClient({ siteImages }: { siteImages: any }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const lang = params?.lang || 'es';
  const isEn = lang === 'en';
  const langPrefix = `/${lang || 'es'}`;
  const [isNavigating, setIsNavigating] = useState(false);
  const { openBookingModal } = useBooking();
  const formatPrice = (amountInMxn: number) => `$${Math.round(amountInMxn)} MXN`;

  const texts = {
    heroTitle: isEn ? 'Food Services' : 'Servicios de Comida',
    heroSubtitle: isEn ? 'Traditional flavors by our private cook' : 'Sabores tradicionales por nuestro cocinero privado',
    introTitle: isEn ? 'Taste the Paradise' : 'Saborea el Paraíso',
    intro: isEn 
      ? 'Delight your senses with personalized service. Select our 2 options when booking your stay. Treat yourself to a culinary experience and request a chef to prepare your meals.'
      : 'Deleita tus sentidos con un servicio personalizado. Selecciona nuestras 2 opciones al reservar tu estancia. Consiéntete con una experiencia culinaria y solicita a un chef que prepare tus comidas.',
    servicesTitle: isEn ? 'Choose Yours' : 'Elige el Tuyo',
    bookBtn: isEn ? 'Book Now' : 'Reservar Ahora',
    bookTour: isEn ? 'BOOK NOW' : 'RESERVAR AHORA',
    bookTourShort: isEn ? 'BOOK NOW' : 'RESERVAR AHORA',
    featuresTitle: isEn ? 'Why book with us?' : '¿Por qué reservar con nosotros?',
    features: [
      isEn ? 'Fresh, local ingredients' : 'Ingredientes frescos y locales',
      isEn ? 'Personalized service' : 'Servicio personalizado',
      isEn ? 'No cleaning required' : 'Sin preocuparte por limpiar',
      isEn ? 'Traditional Mexican flavors' : 'Sabores tradicionales mexicanos'
    ],
    services: [
      {
        id: 'personalized',
        title: isEn ? 'Personalized Service' : 'Servicio Personalizado',
        time: 'Upon Request',
        icon: Utensils,
        desc: isEn 
          ? 'Large groups and families often purchase their own ingredients. Upon request we provide Personalized Service to manage preparations allowing more time with family and less Stress in the Kitchen.'
          : 'Grupos grandes y familias a menudo compran sus propios ingredientes. A petición, ofrecemos un Servicio Personalizado para manejar las preparaciones, permitiendo más tiempo con la familia y menos estrés en la cocina.',
        image: getImageUrl('/food_services/service_1.webp', siteImages)
      },
      {
        id: 'dinner',
        title: isEn ? 'Dinner Service' : 'Servicio de Cena',
        time: '5:00 PM - 7:00 PM',
        icon: Sunset,
        desc: isEn 
          ? 'For groups wanting to maximize daily activities we offer dinner Service between 5:00 and 7:00 PM (Pacific Time). Our chef will prepare a meal from our dinner menu and look after the kitchen for you. Treat your family to an evening of Authentic Mexican Cuisine! This Service is perfect for groups of 6–12 people. Select these Service Options when booking your stay!'
          : 'Para grupos que deseen maximizar las actividades diarias, ofrecemos Servicio de Cena entre 5:00 y 7:00 PM (Hora del Pacífico). Nuestro chef preparará una comida de nuestro menú de cena y se encargará de la cocina por usted. ¡Invite a su familia a una noche de auténtica cocina mexicana! Este servicio es perfecto para grupos de 6 a 12 personas. ¡Seleccione estas opciones de servicio al reservar su estancia!',
        image: getImageUrl('/food_services/service_2.webp', siteImages)
      }
    ]
  };

  const carouselImages = [
    getImageUrl('/food_services/carousel_1.webp', siteImages),
    getImageUrl('/food_services/carousel_2.webp', siteImages),
    getImageUrl('/food_services/carousel_3.webp', siteImages),
    getImageUrl('/food_services/carousel_4.webp', siteImages),
    getImageUrl('/food_services/carousel_5.webp', siteImages),
    getImageUrl('/food_services/carousel_6.webp', siteImages),
  ];

  const [[page, direction], setPage] = useState([0, 0]);
  const handleDragEnd = (e: any, { offset, velocity }: any) => {
    const swipe = Math.abs(offset.x) * velocity.x;
    if (swipe < -10000 || offset.x < -50) {
      setPage([page + 1, 1]);
    } else if (swipe > 10000 || offset.x > 50) {
      setPage([page - 1, -1]);
    }
  };
  const currentImageIndex = Math.abs(page % carouselImages.length);

  return (
    <div className="bg-[#FAF8F5] min-h-screen font-sans selection:bg-[#9B7E67] selection:text-white">
      <ActionLoadingScreen isOpen={isNavigating} theme="dark" subMessage={isEn ? 'ONE MOMENT PLEASE...' : 'UN MOMENTO POR FAVOR...'} />
      
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
                aria-label={isEn ? 'BACK TO HOME' : 'VOLVER AL INICIO'}
              >
                <ArrowLeft strokeWidth={1.5} className="w-5 h-5 md:w-6 md:h-6 transform group-hover:-translate-x-1 transition-transform" />
                <span className="hidden md:block uppercase tracking-[0.2em] text-xs font-bold text-[#F9F7F4]">
                  {isEn ? 'HOME' : 'INICIO'}
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
                        <span className="text-sm md:text-base leading-none block tracking-widest">{l.toUpperCase()}</span>
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
                  onClick={() => {
                    openBookingModal();
                  }}
                  className="whitespace-nowrap uppercase tracking-widest text-[10px] md:text-xs font-bold border rounded-full px-4 py-1.5 hover:opacity-70 transition-all border-[#F9F7F4] text-[#F9F7F4]"
                >
                  <span className="hidden md:inline">{texts.bookTour}</span>
                  <span className="md:hidden">{texts.bookTourShort}</span>
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
      <section className="relative min-h-[85vh] md:h-screen flex items-center justify-center overflow-hidden">
        <motion.div 
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          <Image 
            src={getImageUrl('/DSC_0226.webp', siteImages)}
            alt="Chef Service"
            fill
            className="object-cover object-center"
            priority
          />
        </motion.div>
        
        {/* Warm Gradient Overlay for Food Psychology (Warm colors stimulate appetite) */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#2C2621]/80 via-[#2C2621]/60 to-[#4A3B32]/80 mix-blend-multiply"></div>
        
        <div className="absolute inset-0 bg-black/20"></div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative z-10 text-center px-6 max-w-4xl mx-auto pt-32"
        >

          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-[#F9F7F4] mb-6 drop-shadow-2xl leading-tight">
            {texts.heroTitle}
          </h1>
          <p className="text-[#F9F7F4]/90 text-lg md:text-xl font-light max-w-2xl mx-auto drop-shadow-md">
            {texts.intro}
          </p>
        </motion.div>
      </section>

      {/* Services Section */}
      <section className="py-20 md:py-32 px-4 md:px-12 lg:px-20 max-w-[1400px] mx-auto bg-[#FAF8F5]">
        <div className="text-center mb-16 md:mb-24">
          <h2 className="text-[#9B7E67] uppercase tracking-[0.3em] text-xs font-bold mb-4">
            {texts.servicesTitle}
          </h2>
          <h3 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#2C2621]">
            {isEn ? 'Meal Service Options' : 'Opciones de Servicio de Comida'}
          </h3>
        </div>

        <div className="flex flex-col gap-16 md:gap-32">
          {texts.services.map((service, index) => {
            const Icon = service.icon;
            return (
              <motion.div 
                key={service.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`flex flex-col ${index % 2 !== 0 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-10 md:gap-16 lg:gap-24`}
              >
                {/* Image container */}
                <div className="w-full md:w-1/2 relative group">
                  <div className="relative h-[400px] md:h-[600px] w-full rounded-[2rem] overflow-hidden shadow-2xl">
                    <Image 
                      src={service.image} 
                      alt={service.title} 
                      fill
                      className="object-cover transition-transform duration-1000 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2C2621]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  </div>
                </div>

                {/* Content */}
                <div className="w-full md:w-1/2 flex flex-col justify-center px-4 md:px-0">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="w-12 h-[1px] bg-[#D4A373]"></span>
                    <span className="text-[#D4A373] text-[10px] uppercase tracking-[0.2em] font-bold">
                      {isEn ? 'Service 0' + (index + 1) : 'Servicio 0' + (index + 1)}
                    </span>
                  </div>
                  
                  <h3 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#2C2621] mb-6 leading-tight">
                    {service.title}
                  </h3>
                  
                  <p className="text-[#4A3B32] text-lg md:text-xl font-light mb-10 leading-relaxed">
                    {service.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Carousel Gallery */}
        <div className="mt-24 md:mt-32 max-w-[1000px] mx-auto overflow-hidden relative" style={{ touchAction: 'pan-y' }}>
          <div className="relative h-[300px] md:h-[500px] w-full rounded-[2rem] overflow-hidden bg-gray-100 flex items-center justify-center">
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={page}
                custom={direction}
                initial={{ x: direction > 0 ? 1000 : -1000, opacity: 0 }}
                animate={{ zIndex: 1, x: 0, opacity: 1 }}
                exit={{ zIndex: 0, x: direction < 0 ? 1000 : -1000, opacity: 0 }}
                transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={1}
                onDragEnd={handleDragEnd}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
              >
                <Image 
                  src={carouselImages[currentImageIndex]} 
                  alt="Gallery" 
                  fill 
                  className="object-cover" 
                  draggable={false} 
                />
              </motion.div>
            </AnimatePresence>
            {/* Blinking Drag Indicator */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              <motion.div 
                animate={{ opacity: [0.3, 1, 0.3] }} 
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="bg-black/50 backdrop-blur-sm text-white px-6 py-3 rounded-full flex flex-col items-center gap-2 shadow-xl border border-white/20"
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    animate={{ x: [0, -5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </motion.div>
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 10a.5.5 0 0 1 .5.5V14a.5.5 0 0 0 1 0v-4a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 0 1 0v-3.2a.5.5 0 0 1 .5.5v3a.5.5 0 0 0 1 0v-2a.5.5 0 0 1 1 0v6.1c0 2.2-2 4.1-4 4.1S7 20 7 17.8V11a1 1 0 0 1 2 0Z"/>
                  </svg>
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </motion.div>
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.2em]">
                  {isEn ? 'Drag to explore' : 'Arrastra para explorar'}
                </span>
              </motion.div>
            </div>
          </div>
          <div className="flex justify-center gap-2 mt-6">
            {carouselImages.map((_, idx) => (
              <button 
                key={idx} 
                onClick={() => setPage([idx, idx > currentImageIndex ? 1 : -1])}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentImageIndex ? 'bg-[#9B7E67] w-6' : 'bg-[#E5E0D8]'}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-20 md:py-32 px-6 md:px-12 bg-white text-center relative">
        <div className="max-w-3xl mx-auto relative z-10">
          <Utensils className="mx-auto text-[#D4A373] mb-6 w-10 h-10 md:w-12 md:h-12 opacity-80" />
          <h2 className="font-serif text-3xl md:text-5xl text-[#2C2621] mb-8">
            {texts.introTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 text-left">
            {texts.features.map((feature, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.5 }}
                className="flex items-center gap-4 bg-[#FAF8F5] p-4 rounded-2xl shadow-sm border border-[#E5E0D8]/50"
              >
                <div className="bg-[#D4A373]/20 p-2 rounded-full text-[#D4A373]">
                  <CheckCircle2 size={20} />
                </div>
                <span className="text-[#4A3B32] font-medium text-sm md:text-base">{feature}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />

    </div>
  );
}

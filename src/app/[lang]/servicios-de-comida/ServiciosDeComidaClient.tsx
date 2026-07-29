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
          ? 'Large groups and families often purchase ingredients and prepare their own meals. Select from our Personalized Service options to request extra help in the kitchen. Our staff will assist you with preparations, service and clean up allowing more for more time with family and less stress in the kitchen.'
          : 'Los grupos grandes y las familias a menudo compran ingredientes y preparan sus propias comidas. Elija entre nuestras opciones de Servicio Personalizado para solicitar ayuda adicional en la cocina. Nuestro personal lo asistirá con las preparaciones, el servicio y la limpieza, permitiendo más tiempo con la familia y menos estrés en la cocina.',
        image: getImageUrl('/food_services/service_1.webp', siteImages)
      },
      {
        id: 'dinner',
        title: isEn ? 'Dinner Service' : 'Servicio de Cena',
        time: '5:00 PM - 7:00 PM',
        icon: Sunset,
        desc: isEn 
          ? 'For groups wanting to maximize daily activities we offer dinner Service between 5:00 and 7:00 PM (Pacific Time). Our chef will prepare a meal from our dinner menu and look after the kitchen for you. Treat your family to an evening of Authentic Mexican Cuisine! This Service is perfect for groups of 6-12 people.'
          : 'Para los grupos que desean maximizar las actividades diarias, ofrecemos servicio de cena entre las 5:00 y las 7:00 PM (hora del Pacífico). Nuestro chef preparará una comida de nuestro menú de cena y se encargará de la cocina por usted. ¡Invite a su familia a una noche de auténtica cocina mexicana! Este servicio es perfecto para grupos de 6 a 12 personas.',
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
            {isEn ? 'Food Services Options' : 'Opciones de Servicios de Comida'}
          </h3>
        </div>

        <div className="flex flex-col md:flex-row gap-10 md:gap-16 lg:gap-24 items-start">
          {/* Main Visual */}
          <div className="w-full md:w-1/2 relative group md:sticky md:top-32">
            <div className="relative h-[400px] md:h-[700px] w-full rounded-[2rem] overflow-hidden shadow-2xl">
              <Image 
                src={texts.services[0].image} 
                alt="Food Services" 
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#2C2621]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </div>
          </div>

          {/* Vertical Options */}
          <div className="w-full md:w-1/2 flex flex-col relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute left-[15px] top-10 bottom-10 w-[2px] bg-gradient-to-b from-[#D4A373]/50 via-[#D4A373]/20 to-transparent z-0"></div>

            {texts.services.map((service, index) => (
              <motion.div 
                key={service.id}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className={`relative z-10 ${index !== 0 ? 'mt-20 md:mt-32' : ''}`}
              >
                <div className="flex gap-6">
                  {/* Indicator Dot */}
                  <div className="hidden md:flex mt-2 w-8 h-8 rounded-full bg-[#FAF8F5] border-4 border-[#D4A373] items-center justify-center shrink-0 shadow-sm relative -ml-[15px]">
                    <div className="w-2 h-2 rounded-full bg-[#2C2621]"></div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-8 h-[1px] bg-[#D4A373]"></span>
                      <span className="text-[#D4A373] text-[10px] uppercase tracking-[0.2em] font-bold">
                        {isEn ? 'Option 0' + (index + 1) : 'Opción 0' + (index + 1)}
                      </span>
                    </div>
                    
                    <h3 className="font-serif text-3xl md:text-4xl lg:text-5xl text-[#2C2621] mb-4 leading-tight">
                      {service.title}
                    </h3>
                    
                    <p className="text-[#4A3B32] text-base md:text-lg font-light leading-relaxed">
                      {service.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
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

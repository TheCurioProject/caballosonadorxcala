'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Utensils, Clock, ArrowRight, CheckCircle2, ChevronRight, Calendar as CalendarIcon, Coffee, Sunset } from 'lucide-react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Footer } from '@/components/home/Footer';
import { FoodBookingModal } from '@/components/booking/FoodBookingModal';

export default function ServiciosDeComida() {
  const params = useParams();
  const lang = params?.lang || 'es';
  const isEn = lang === 'en';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const texts = {
    heroTitle: isEn ? 'Culinary Experience' : 'Experiencia Culinaria',
    heroSubtitle: isEn ? 'Traditional flavors by our private cook' : 'Sabores tradicionales por nuestro cocinero privado',
    introTitle: isEn ? 'Taste the Paradise' : 'Saborea el Paraíso',
    intro: isEn 
      ? 'Delight your senses with our personalized food services. Our private cook prepares traditional dishes with an unmatched Mexican flavor using fresh, seasonal ingredients. You decide: you can bring your own ingredients for our team to prepare, or let us take care of absolutely everything, ensuring every meal is memorable.'
      : 'Deleita tus sentidos con nuestros servicios de comida personalizados. Nuestro cocinero privado prepara platillos tradicionales con un inigualable sazón mexicano utilizando ingredientes frescos y de temporada. Tú decides: puedes traer tus propios ingredientes para que nuestro equipo los prepare, o dejar que nosotros nos encarguemos de absolutamente todo, asegurando que cada comida sea memorable.',
    servicesTitle: isEn ? 'Choose Your Experience' : 'Elige tu Experiencia',
    bookBtn: isEn ? 'Book Now' : 'Reservar Ahora',
    featuresTitle: isEn ? 'Why book with us?' : '¿Por qué reservar con nosotros?',
    features: [
      isEn ? 'Fresh, local ingredients' : 'Ingredientes frescos y locales',
      isEn ? 'Personalized menus' : 'Menús personalizados',
      isEn ? 'No cooking or cleaning required' : 'Sin preocuparte por cocinar o limpiar',
      isEn ? 'Delicious traditional Mexican seasoning' : 'Delicioso sazón tradicional mexicano'
    ],
    services: [
      {
        id: 'breakfast',
        title: isEn ? 'Breakfast' : 'Desayuno',
        time: '8:00 AM - 10:00 AM',
        icon: Coffee,
        desc: isEn 
          ? 'Start your day with a delicious freshly prepared breakfast. Includes coffee, fresh juices, seasonal fruit, and your choice of main dish.'
          : 'Comienza tu día con un delicioso desayuno preparado al momento. Incluye café, jugos frescos, fruta de temporada y plato fuerte a elegir.',
        price: isEn ? 'From $25 USD / pax' : 'Desde $25 USD / pax',
        image: '/imagenes/05_amenities/amenity_05_guest_kitchen.webp'
      },
      {
        id: 'breakfast_lunch',
        title: isEn ? 'Breakfast & Lunch' : 'Desayuno y Comida',
        time: '8:00 AM - 2:00 PM',
        icon: Utensils,
        desc: isEn 
          ? 'The perfect option for those planning to spend the day at the house. Enjoy a full breakfast and a spectacular lunch by the pool.'
          : 'La opción perfecta para quienes planean pasar el día en la casa. Disfruta de un desayuno completo y una comida espectacular junto a la piscina.',
        price: isEn ? 'From $45 USD / pax' : 'Desde $45 USD / pax',
        image: '/imagenes/05_amenities/amenity_02_pool_lounge.webp'
      },
      {
        id: 'dinner',
        title: isEn ? 'Dinner' : 'Cena',
        time: '5:00 PM - 7:00 PM',
        icon: Sunset,
        desc: isEn 
          ? 'An unforgettable culinary evening. Exquisite dishes to close the day while enjoying the sunset and the sea breeze.'
          : 'Una velada culinaria inolvidable. Platillos exquisitos para cerrar el día mientras disfrutas del atardecer y la brisa marina.',
        price: isEn ? 'From $35 USD / pax' : 'Desde $35 USD / pax',
        image: '/tours_gallery/07_volcano/00_sunset_019.webp'
      }
    ]
  };

  const handleBook = (id: string) => {
    setSelectedService(id);
    setIsModalOpen(true);
  };

  return (
    <div className="bg-[#FAF8F5] min-h-screen font-sans selection:bg-[#9B7E67] selection:text-white">
      
      {/* Hero Section */}
      <section className="relative h-[70vh] md:h-[80vh] flex items-center justify-center overflow-hidden">
        <motion.div 
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          <Image 
            src="/DSC_0226.webp" 
            alt="Food Experience" 
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
          className="relative z-10 text-center px-6 max-w-4xl mx-auto"
        >
          <div className="mb-6 flex justify-center">
            <span className="bg-[#9B7E67]/90 text-white text-[10px] uppercase tracking-[0.3em] font-bold px-4 py-1.5 rounded-full backdrop-blur-sm shadow-xl border border-white/10">
              {texts.heroSubtitle}
            </span>
          </div>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-[#F9F7F4] mb-6 drop-shadow-2xl leading-tight">
            {texts.heroTitle}
          </h1>
          <p className="text-[#F9F7F4]/90 text-lg md:text-xl font-light max-w-2xl mx-auto drop-shadow-md">
            {texts.intro}
          </p>
        </motion.div>
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

      {/* Services Section */}
      <section className="py-20 md:py-32 px-4 md:px-12 lg:px-20 max-w-[1400px] mx-auto bg-[#FAF8F5]">
        <div className="text-center mb-16 md:mb-24">
          <h2 className="text-[#9B7E67] uppercase tracking-[0.3em] text-xs font-bold mb-4">
            {texts.servicesTitle}
          </h2>
          <h3 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#2C2621]">
            {isEn ? 'A menu for every moment' : 'Un menú para cada momento'}
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
                  {/* Floating time badge */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                    className={`absolute ${index % 2 !== 0 ? 'left-6 md:-left-8' : 'right-6 md:-right-8'} -bottom-8 bg-white p-4 md:p-6 rounded-2xl shadow-xl flex items-center gap-4 border border-[#E5E0D8]`}
                  >
                    <div className="bg-[#D4A373]/10 p-3 rounded-full text-[#D4A373]">
                      <Icon size={24} />
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-widest text-[#9B7E67] font-bold mb-1">
                        {isEn ? 'Schedule' : 'Horario'}
                      </span>
                      <span className="block font-serif text-lg md:text-xl text-[#2C2621]">
                        {service.time}
                      </span>
                    </div>
                  </motion.div>
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
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <button 
                      onClick={() => handleBook(service.id)}
                      className="group bg-[#2C2621] text-[#F9F7F4] px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-[#D4A373] transition-all duration-300 flex items-center gap-3 w-full sm:w-auto justify-center"
                    >
                      {texts.bookBtn} 
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                    {/* El precio dinámico vendrá de BD, pero por ahora se muestra como sugerencia/desde */}
                    {/* En la integración real, este precio vendrá de la tabla ServicePricing */}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 md:py-32 bg-[#2C2621] text-[#F9F7F4] text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <Utensils className="mx-auto text-[#D4A373] mb-6 w-12 h-12 opacity-80" />
          <h2 className="font-serif text-4xl md:text-6xl mb-6">
            {isEn ? 'Ready for a feast?' : '¿Listo para un festín?'}
          </h2>
          <p className="text-[#F9F7F4]/80 font-light text-lg md:text-xl mb-10">
            {isEn 
              ? 'Book your meals in advance to guarantee availability and personalize your menu.' 
              : 'Reserva tus comidas con anticipación para garantizar disponibilidad y personalizar tu menú.'}
          </p>
          <button 
            onClick={() => handleBook('breakfast_lunch')}
            className="bg-[#D4A373] text-white px-10 py-5 rounded-full text-sm font-bold uppercase tracking-widest shadow-2xl hover:bg-white hover:text-[#2C2621] transition-all duration-500"
          >
            {texts.bookBtn}
          </button>
        </motion.div>
      </section>

      <Footer />

      {/* Modal para reservar servicios específicos */}
      <FoodBookingModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialService={selectedService}
        lang={lang as string}
      />
    </div>
  );
}

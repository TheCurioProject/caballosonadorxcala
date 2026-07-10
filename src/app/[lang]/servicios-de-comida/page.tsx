'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChefHat, Utensils, Clock, ArrowRight, X, Calendar as CalendarIcon, Users } from 'lucide-react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { FoodBookingModal } from '@/components/booking/FoodBookingModal';

// Componente para el modal (simplificado, luego lo mejoramos en su propio archivo)
// Lo pondremos por ahora aquí o lo importamos si lo creamos luego.
// Para mantener el diseño, lo dejaremos como un placeholder estilizado que indica que se abrirá pronto,
// o si me da tiempo lo creo completo.

export default function ServiciosDeComida() {
  const params = useParams();
  const lang = params?.lang || 'es';
  const isEn = lang === 'en';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const texts = {
    heroTitle: isEn ? 'Culinary Experience' : 'Experiencia Culinaria',
    heroSubtitle: isEn ? 'Exquisite flavors in paradise' : 'Sabores exquisitos en el paraíso',
    intro: isEn 
      ? 'Delight your senses with our exclusive food services. Our private chef prepares authentic local and international dishes using fresh, seasonal ingredients.'
      : 'Deleita tus sentidos con nuestros exclusivos servicios de comida. Nuestro chef privado prepara auténticos platillos locales e internacionales utilizando ingredientes frescos y de temporada.',
    servicesTitle: isEn ? 'Our Services' : 'Nuestros Servicios',
    bookBtn: isEn ? 'Book Service' : 'Reservar Servicio',
    services: [
      {
        id: 'breakfast',
        title: isEn ? 'Breakfast' : 'Desayuno',
        time: '8:00 AM - 10:00 AM',
        desc: isEn 
          ? 'Start your day with a delicious freshly prepared breakfast. Includes coffee, fresh juices, seasonal fruit, and your choice of main dish.'
          : 'Comienza tu día con un delicioso desayuno preparado al momento. Incluye café, jugos frescos, fruta de temporada y plato fuerte a elegir.',
        price: '$25 USD',
        image: '/imagenes/05_amenities/amenity_05_guest_kitchen.webp'
      },
      {
        id: 'breakfast_lunch',
        title: isEn ? 'Breakfast & Lunch' : 'Desayuno y Comida',
        time: '8:00 AM - 2:00 PM',
        desc: isEn 
          ? 'The perfect option for those planning to spend the day at the house. Enjoy a full breakfast and a spectacular lunch by the pool.'
          : 'La opción perfecta para quienes planean pasar el día en la casa. Disfruta de un desayuno completo y una comida espectacular junto a la piscina.',
        price: '$45 USD',
        image: '/imagenes/05_amenities/amenity_02_pool_lounge.webp'
      },
      {
        id: 'dinner',
        title: isEn ? 'Dinner' : 'Cena',
        time: '5:00 PM - 7:00 PM',
        desc: isEn 
          ? 'An unforgettable culinary evening. Exquisite dishes to close the day while enjoying the sunset and the sea breeze.'
          : 'Una velada culinaria inolvidable. Platillos exquisitos para cerrar el día mientras disfrutas del atardecer y la brisa marina.',
        price: '$35 USD',
        image: '/tours_gallery/07_volcano/00_sunset_019.webp'
      }
    ]
  };

  const handleBook = (id: string) => {
    setSelectedService(id);
    setIsModalOpen(true);
  };

  return (
    <div className="bg-[#F9F7F4] min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative h-[60vh] md:h-[70vh] flex items-center justify-center overflow-hidden">
        <Image 
          src="/imagenes/05_amenities/amenity_02_pool_lounge.webp" 
          alt="Comida" 
          fill
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[#1A1816]/50"></div>
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="relative z-10 text-center px-4"
        >
          <ChefHat className="mx-auto text-[#9B7E67] mb-6 w-12 h-12 md:w-16 md:h-16 opacity-90" />
          <h1 className="font-serif text-5xl md:text-7xl text-white mb-4 drop-shadow-lg">
            {texts.heroTitle}
          </h1>
          <p className="text-[#F9F7F4]/90 uppercase tracking-[0.3em] text-xs md:text-sm font-bold">
            {texts.heroSubtitle}
          </p>
        </motion.div>
      </section>

      {/* Intro Section */}
      <section className="py-20 md:py-32 px-6 md:px-16 max-w-[1200px] mx-auto text-center">
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-xl md:text-3xl font-serif text-[#2C2927] leading-relaxed max-w-4xl mx-auto"
        >
          "{texts.intro}"
        </motion.p>
      </section>

      {/* Services Section */}
      <section className="py-10 pb-32 px-4 md:px-16 max-w-[1400px] mx-auto">
        <div className="flex flex-col gap-12 md:gap-24">
          {texts.services.map((service, index) => (
            <motion.div 
              key={service.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className={`flex flex-col ${index % 2 !== 0 ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-8 md:gap-16`}
            >
              {/* Image */}
              <div className="w-full md:w-1/2 h-[400px] md:h-[500px] relative rounded-[2rem] overflow-hidden shadow-2xl">
                <Image 
                  src={service.image} 
                  alt={service.title} 
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-1000"
                />
              </div>

              {/* Content */}
              <div className="w-full md:w-1/2 flex flex-col justify-center">
                <div className="text-[#9B7E67] mb-4">
                  <Utensils className="w-8 h-8" />
                </div>
                <h2 className="font-serif text-4xl md:text-5xl text-[#2C2927] mb-4">
                  {service.title}
                </h2>
                <div className="flex items-center gap-2 text-[#9B7E67] font-bold uppercase tracking-widest text-xs mb-6">
                  <Clock className="w-4 h-4" />
                  <span>{service.time}</span>
                </div>
                <p className="text-[#2C2927]/70 text-lg mb-8 leading-relaxed">
                  {service.desc}
                </p>
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => handleBook(service.id)}
                    className="bg-[#2C2927] text-[#F9F7F4] px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-[#9B7E67] transition-colors duration-300 flex items-center gap-2"
                  >
                    {texts.bookBtn} <ArrowRight className="w-4 h-4" />
                  </button>
                  <span className="font-serif text-2xl text-[#2C2927]">{service.price}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <Footer />

      <FoodBookingModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialService={selectedService}
        lang={lang as string}
      />
    </div>
  );
}

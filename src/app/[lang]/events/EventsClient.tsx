'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { getImageUrl } from '@/lib/siteImages';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

export default function EventsClient({ siteImages }: { siteImages: any }) {
  const benefits = [
    'Palapa Panorámica con Vistas al Mar (Ideal para Yoga)',
    'Acceso Exclusivo a las 5 Habitaciones y 1 Suite Deluxe',
    'Privacidad Total en Piscina y Jacuzzi',
    'Cocina Completa para Servicio de Catering',
    'A solo 5 minutos a pie de la playa',
    'Asistencia en la Planificación de Excursiones Grupales'
  ];

  const heroImg = getImageUrl('/imagenes/09_events/events_retreat_intro.webp', siteImages);
  const retreatImg = getImageUrl('/imagenes/09_events/events_retreat.webp', siteImages);
  const weddingImg = getImageUrl('/imagenes/11_blog/blog_elle_and_shawn.webp', siteImages);
  const groupImg = getImageUrl('/imagenes/07_tours/tour_molote_alt_rtrt001.webp', siteImages);

  return (
    <div className="w-full min-h-screen bg-brand-cream pt-20">
      
      {/* Hero */}
      <section className="relative h-[60vh] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Retiros de Bienestar" className="w-full h-full object-cover" style={{ objectPosition: 'center 40%' }} />
          <div className="absolute inset-0 bg-black/50"></div>
        </div>
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto"
        >
          <h1 className="text-4xl md:text-6xl mb-4 font-serif text-brand-white drop-shadow-md">Tu Espacio Exclusivo para Retiros</h1>
          <p className="text-lg md:text-2xl font-light opacity-90 mb-10">Involúcrate en una experiencia de autodescubrimiento. Reserva la casa completa y transforma tus eventos en momentos inolvidables.</p>
          <a 
            href="https://wa.me/message/UHSDYFMOOVTJI1" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block bg-brand-white text-brand-dark px-8 py-4 uppercase tracking-widest text-sm font-semibold hover:bg-brand-cream hover:scale-105 transition-all shadow-xl"
          >
            Cotizar mi Evento
          </a>
        </motion.div>
      </section>

      {/* Por qué Elegirnos */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn}>
            <h2 className="text-3xl md:text-5xl font-serif text-brand-dark mb-8">Un Entorno Diseñado para la Transformación</h2>
            <div className="w-24 h-1 bg-brand-dark/20 mx-auto mb-10"></div>
            <p className="text-gray-600 font-light text-lg md:text-xl leading-relaxed mb-6">
              Sabemos que cada evento es único. Ofrecemos nuestra villa boutique anidada en la orilla del Pacífico y en la base de un volcán inactivo. Te ayudamos a curar un paquete tan personalizado como tu visión, acomodando hasta 14 personas en total privacidad.
            </p>
            <p className="text-gray-600 font-light text-lg md:text-xl leading-relaxed">
              ¿Buscas ofrecer a otros una experiencia transformadora en la seguridad y serenidad de una pequeña comunidad costera? Venir a Chacala es más que unas vacaciones; es como volver a casa. Hunde tus pies en la arena, báñate en el mar y sumérgete en tesoros culturales. Reconecta con tu pasión a través de la naturaleza.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Amenidades Especiales */}
      <section className="py-24 px-4 bg-brand-dark text-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="w-full md:w-1/2">
              <img src={retreatImg} alt="Yoga y Bienestar" className="w-full h-auto object-cover shadow-2xl" />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="w-full md:w-1/2">
              <h2 className="text-3xl md:text-5xl font-serif mb-8 text-brand-white">Todo Preparado para Tu Éxito</h2>
              <ul className="space-y-6">
                {benefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-4 text-gray-300">
                    <CheckCircle2 className="w-6 h-6 text-brand-white flex-shrink-0 mt-1" />
                    <span className="text-lg font-light leading-snug">{benefit}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Galería e Inspiración */}
      <section className="py-24 px-4 bg-[#F2F0EA] text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn} className="max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-serif text-brand-dark mb-6">Memorias Inolvidables</h2>
          <p className="text-gray-600 font-light text-lg">
            Organiza tu próxima boda íntima, cumpleaños, fiesta de compromiso o retiro de sanación junto al océano. Deja volar tu imaginación y descubre las infinitas posibilidades que ofrece Casa Caballo Soñador.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl mx-auto mb-16">
           <div className="relative h-96 group overflow-hidden">
             <img src={weddingImg} alt="Boda Íntima" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
             <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
               <h3 className="text-white text-2xl font-serif opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">Bodas Íntimas</h3>
             </div>
           </div>
           <div className="relative h-96 group overflow-hidden">
             <img src={groupImg} alt="Retiros Grupales" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
             <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
               <h3 className="text-white text-2xl font-serif opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">Retiros Grupales</h3>
             </div>
           </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <a 
            href="https://wa.me/message/UHSDYFMOOVTJI1" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block bg-brand-dark text-brand-white px-10 py-5 uppercase tracking-widest text-sm font-semibold hover:bg-black transition-colors shadow-lg"
          >
            Contactarnos para Registrar tu Evento
          </a>
        </motion.div>
      </section>

    </div>
  );
}

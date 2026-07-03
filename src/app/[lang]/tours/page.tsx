'use client';

import { motion } from 'framer-motion';
import { MapPin, Clock, DollarSign, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

export default function Tours() {
  const tours = [
    {
      id: 1,
      name: 'Ojo de Agua',
      desc: 'Un viaje a través de frondosos huertos hasta llegar a un paraíso escondido. Sumérgete en este manantial prístino de aguas frías, ideal para escapar del calor. Explora los alrededores para descubrir antiguos petroglifos o simplemente relájate en las piscinas naturales.',
      details: { duration: 'Medio Día', price: '$75 USD', inc: 'Pick-up incluido' },
      img: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/tour_ojo_de_agua.jpg`,
    },
    {
      id: 2,
      name: 'Aguas Termales del Río Molote',
      desc: 'Atraviesa paisajes agrícolas idílicos y descubre técnicas de irrigación ancestrales. Tras una vigorizante caminata por el cauce del río, relájate en las cálidas entradas termales y nada en las refrescantes aguas río abajo. Un contraste natural espectacular.',
      details: { duration: '6-8 Horas', price: '$90 USD', inc: 'Pick-up incluido' },
      img: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/tour_molote.jpg`,
    },
    {
      id: 3,
      name: 'Cascada El Capomo',
      desc: 'Una expedición emocionante por la selva. Realiza un ascenso de 600 metros a lo largo del arroyo hasta llegar a tu recompensa: un baño revitalizante en la piscina natural bajo una majestuosa cascada de 15 metros.',
      details: { duration: '4-5 Horas', price: '$90 USD', inc: 'Pick-up incluido' },
      img: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/tour_el_capomo.jpg`,
    },
    {
      id: 4,
      name: 'Playa Las Cuevas',
      desc: 'A solo una hora de Chacala, este tesoro escondido bajo un tapón volcánico es un santuario donde las fuerzas del agua y el fuego han esculpido la tierra. Su naturaleza aislada la hace perfecta para grupos que buscan meditación o playa ininterrumpida.',
      details: { duration: 'Medio Día', price: '$80 USD', inc: 'Pick-up incluido' },
      img: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/tour_los_cuevas.jpg`,
    },
    {
      id: 5,
      name: 'Jamurrca',
      desc: 'Relájate en instalaciones termales libres de químicos. Cuenta con piscinas cristalinas, bañeras de hidromasaje y áreas de descanso bajo palmeras altas. Excelente para familias y grupos que buscan comodidad y sanación.',
      details: { duration: 'Medio Día', price: '$75 USD', inc: 'Pick-up incluido' },
      img: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/tour_jumurrca.jpg`,
    },
    {
      id: 6,
      name: 'Alta Vista (Petroglifos)',
      desc: 'Adéntrate en un sitio sagrado milenario. Los petroglifos, que servían como guías espirituales y de navegación para civilizaciones antiguas, te revelarán los ciclos de la tierra. Un destino imperdible para amantes de la historia y el misticismo.',
      details: { duration: '4-5 Horas', price: '$75 USD', inc: 'Pick-up incluido' },
      img: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/tour_alta_vista.jpg`,
    },
    {
      id: 7,
      name: 'Tour de Atardecer en el Volcán',
      desc: 'Navega a través de la densa selva hasta la cima de un volcán inactivo con vista a la Bahía de Chacala. Serás testigo de un espectáculo ininterrumpido donde el sol, la luna y las estrellas se reflejan mágicamente sobre el océano.',
      details: { duration: '2-3 Horas', price: '$75 USD', inc: 'Pick-up incluido' },
      img: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/tour_volcano_sunset.jpg`,
    },
  ];

  return (
    <div className="w-full min-h-screen bg-brand-cream pt-20">
      
      {/* Hero */}
      <section className="relative h-[50vh] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/tour_ojo_de_agua.jpg`} alt="Tours de Aventura" className="w-full h-full object-cover" style={{ objectPosition: 'center 30%' }} />
          <div className="absolute inset-0 bg-black/40"></div>
        </div>
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto"
        >
          <h1 className="text-4xl md:text-6xl mb-4 font-serif text-brand-white drop-shadow-md">Aventuras y Tours Exclusivos</h1>
          <p className="text-lg md:text-2xl font-light opacity-90">Explora las maravillas ocultas de Chacala. Conecta con la naturaleza, la historia y la energía vibrante de México.</p>
        </motion.div>
      </section>

      {/* Destino Chacala */}
      <section className="py-20 px-4 bg-white text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn} className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif text-brand-dark mb-6">Descubre la Magia de Chacala</h2>
          <div className="w-16 h-[2px] bg-brand-dark/20 mx-auto mb-8"></div>
          <p className="text-gray-600 font-light text-lg leading-relaxed">
            Escondido en una pequeña cala a lo largo de la costa del Pacífico, Chacala destaca por su encanto prístino. Su nombre, que significa "donde hay camarones" en Náhuatl, refleja su profunda conexión con la cultura local. Ofrecemos playas sin multitudes, selva exuberante y un ambiente acogedor.
          </p>
        </motion.div>
      </section>

      {/* Catálogo de Tours */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tours.map((tour, i) => (
            <motion.div 
              key={tour.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: (i % 3) * 0.1 }}
              className="bg-white group overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col"
            >
              <div className="relative h-64 overflow-hidden">
                <img src={tour.img} alt={tour.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 text-sm font-semibold text-brand-dark">
                  {tour.details.price}
                </div>
              </div>
              <div className="p-8 flex flex-col flex-grow">
                <h3 className="text-2xl font-serif text-brand-dark mb-4">{tour.name}</h3>
                <p className="text-gray-600 font-light text-sm mb-6 flex-grow">{tour.desc}</p>
                <div className="space-y-2 mb-8 pt-4 border-t border-gray-100">
                  <div className="flex items-center text-sm text-gray-500 gap-3"><Clock size={16} className="text-brand-dark/50"/> {tour.details.duration}</div>
                  <div className="flex items-center text-sm text-gray-500 gap-3"><MapPin size={16} className="text-brand-dark/50"/> {tour.details.inc}</div>
                </div>
                <a 
                  href="https://wa.me/message/UHSDYFMOOVTJI1" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-between w-full uppercase tracking-widest text-xs font-semibold text-brand-dark hover:text-brand-black group-hover:gap-2 transition-all border border-brand-dark/20 px-6 py-3"
                >
                  Reserva <ChevronRight size={16} />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Experiencias Personalizadas */}
      <section className="py-24 px-4 bg-brand-dark text-white text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn} className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-serif mb-6 text-brand-white">¿Buscas una Aventura a tu Medida?</h2>
          <p className="text-gray-300 font-light text-lg mb-10">
            Ve más allá de nuestros tours destacados. Si deseas una expedición completamente personalizada para ti o tu grupo, cuéntanos tus ideas y diseñaremos una experiencia única.
          </p>
          <a 
            href="https://wa.me/message/UHSDYFMOOVTJI1" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block bg-brand-white text-brand-dark px-8 py-4 uppercase tracking-widest text-sm font-semibold hover:bg-brand-cream hover:scale-105 transition-all shadow-xl"
          >
            Solicitar Tour Personalizado
          </a>
        </motion.div>
      </section>

    </div>
  );
}

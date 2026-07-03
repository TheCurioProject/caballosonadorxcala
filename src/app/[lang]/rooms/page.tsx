'use client';

import { motion } from 'framer-motion';
import { Bed, Users, Bath, Wind, Wifi, Droplets } from 'lucide-react';
import { useBooking } from '@/context/BookingContext';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

export default function Rooms() {
  const { openBookingModal } = useBooking();
  const rooms = [
    {
      id: 1,
      name: 'Paso Suave | Room 1',
      desc: 'Su nombre significa "paso gentil". Es el espacio ideal para amigos, hermanos o viajeros solitarios que comparten una escapada de descanso. Un ambiente aireado con estilo minimalista, tonos calmos y un sutil toque boho.',
      details: { guests: '2', beds: '2 Individuales', bath: '1 Baño' },
      price: 'Desde $135 USD',
      img: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/03_rooms/room1_paso_suave.jpg`,
    },
    {
      id: 2,
      name: 'Estrella | Room 2',
      desc: 'Brillante y acogedora, Estrella resplandece con un encanto íntimo y texturas costeras naturales. Es el lugar perfecto para dejar atrás el estrés y relajarse después de un día explorando las playas de Nayarit.',
      details: { guests: '2', beds: '1 Queen', bath: '1 Baño' },
      price: 'Desde $135 USD',
      img: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/03_rooms/room2_estrella.jpg`,
    },
    {
      id: 3,
      name: 'La Luna | Room 3',
      desc: 'Un retiro pacífico bañado en tonos suaves y luz tenue. La Luna te invita a desconectar bajo una influencia calmante. Ideal para parejas o viajeros solitarios que buscan serenidad absoluta.',
      details: { guests: '2', beds: '1 Queen', bath: '1 Baño' },
      price: 'Desde $125 USD',
      img: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/03_rooms/room3_la_luna.jpg`,
    },
    {
      id: 4,
      name: 'Campo Abierto | Room 4',
      desc: 'Espaciosa y versátil. Los materiales naturales y la decoración cálida crean un refugio hogareño excelente para parejas, amigos o familias pequeñas que valoran el confort.',
      details: { guests: '3', beds: '1 Matrimonial + 1 Day Bed', bath: '1 Baño' },
      price: 'Desde $125 USD',
      img: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/03_rooms/room4_campo_abierto.jpg`,
    },
    {
      id: 6,
      name: 'Madera Viva | Room 6',
      desc: 'Nombrada así por la hermosa madera natural presente en toda la habitación. Ofrece una atmósfera tranquila y arraigada a la tierra, con detalles en piedra tallada por artesanos locales. Para quienes valoran la amplitud y la simplicidad.',
      details: { guests: '2', beds: '1 King', bath: '1 Baño' },
      price: 'Desde $165 USD',
      img: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/03_rooms/room6_madera_viva.jpg`,
    },
    {
      id: 7,
      name: 'El Sueño del Mar | Room 7',
      desc: 'La joya de Casa del Caballo Soñador. Un refugio sereno para estancias románticas o escapes conscientes. Elaborada con madera y piedra local, cuenta con espacio de oficina, sala de estar y vistas inspiradoras.',
      details: { guests: '2', beds: '1 King', bath: '1 Baño', extra: 'Jacuzzi Privado & Vista al Mar' },
      price: 'Desde $185 USD',
      img: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/03_rooms/room7_el_sueno_del_mar.jpg`,
    },
  ];

  return (
    <div className="w-full min-h-screen bg-brand-cream pt-20">
      
      {/* Hero */}
      <section className="relative h-[60vh] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/04_about/about_casa_44.jpg`} alt="Habitaciones" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50"></div>
        </div>
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="relative z-10 text-center text-white px-4 max-w-3xl mx-auto"
        >
          <h1 className="text-4xl md:text-6xl mb-4 font-serif text-brand-white drop-shadow-md">Nuestras Suites</h1>
          <p className="text-lg md:text-2xl font-light opacity-90">Lujo Boutique y Confort Natural. Descubre un santuario de descanso diseñado para integrarse armoniosamente con el entorno.</p>
        </motion.div>
      </section>

      {/* Catálogo de Habitaciones */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <div className="space-y-32">
          {rooms.map((room, i) => (
            <motion.div 
              key={room.id}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={{
                hidden: { opacity: 0, y: 50 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.8 } }
              }}
              className={`flex flex-col lg:flex-row gap-12 items-center ${i % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}
            >
              <div className="w-full lg:w-1/2 overflow-hidden shadow-2xl">
                <img src={room.img} alt={room.name} className="w-full h-[500px] object-cover hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="w-full lg:w-1/2 space-y-6">
                <h2 className="text-3xl md:text-4xl font-serif text-brand-dark">{room.name}</h2>
                <div className="w-16 h-[2px] bg-brand-dark/20"></div>
                <p className="text-gray-600 font-light leading-relaxed text-lg">
                  {room.desc}
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-500 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2"><Users size={16} /> {room.details.guests} Huéspedes</div>
                  <div className="flex items-center gap-2"><Bed size={16} /> {room.details.beds}</div>
                  <div className="flex items-center gap-2"><Bath size={16} /> {room.details.bath}</div>
                  <div className="flex items-center gap-2"><Wind size={16} /> Aire Acond.</div>
                  <div className="flex items-center gap-2"><Wifi size={16} /> Wi-Fi</div>
                  {room.details.extra && <div className="flex items-center gap-2"><Droplets size={16} /> {room.details.extra}</div>}
                </div>
                <div className="pt-4 flex items-center justify-between">
                  <span className="text-xl font-serif italic text-brand-dark">{room.price} <span className="text-sm font-sans not-italic text-gray-500">/ noche</span></span>
                  <button onClick={openBookingModal} className="bg-brand-dark text-white px-8 py-3 uppercase tracking-widest text-xs font-semibold hover:bg-black transition-colors">
                    Reserva
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Info extra */}
      <section className="bg-brand-white py-16 px-4 text-center border-t border-gray-200">
        <p className="text-gray-500 italic max-w-2xl mx-auto">
          Estancia mínima de 2 noches. Todas las habitaciones incluyen acceso a cocina compartida, piscina y desayuno tradicional mexicano.
        </p>
      </section>

      {/* Instalaciones del Hotel */}
      <section className="py-24 px-4 bg-brand-cream">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-serif mb-6 text-brand-dark">Espacios para Inspirar y Relajar</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="bg-white p-8 shadow-sm hover:shadow-xl transition-shadow text-center">
              <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/05_amenities/amenity_09_rooftop_terrace.jpg`} alt="Rooftop" className="w-full h-64 object-cover mb-6" />
              <h3 className="text-2xl font-serif mb-4">La Palapa / Rooftop</h3>
              <p className="text-gray-600 font-light text-sm leading-relaxed">Impresionante palapa al aire libre, perfecta para yoga, meditación, masajes o una siesta. Disfruta de vistas al Océano Pacífico.</p>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="bg-white p-8 shadow-sm hover:shadow-xl transition-shadow text-center">
              <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/05_amenities/amenity_02_pool_lounge.jpg`} alt="Pool" className="w-full h-64 object-cover mb-6" />
              <h3 className="text-2xl font-serif mb-4">La Piscina</h3>
              <p className="text-gray-600 font-light text-sm leading-relaxed">Un oasis tropical inmerso en la selva. Sumérgete, toma el sol y experimenta la energía vibrante de México en total privacidad.</p>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="bg-white p-8 shadow-sm hover:shadow-xl transition-shadow text-center">
              <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/05_amenities/amenity_05_guest_kitchen.jpg`} alt="Cocina" className="w-full h-64 object-cover mb-6" />
              <h3 className="text-2xl font-serif mb-4">Cocina para Huéspedes</h3>
              <p className="text-gray-600 font-light text-sm leading-relaxed">Espacio comunal totalmente equipado donde puedes preparar tus platillos y compartir experiencias culinarias, sintiéndote como en casa.</p>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}

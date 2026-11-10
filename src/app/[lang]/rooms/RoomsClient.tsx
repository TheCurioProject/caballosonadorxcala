'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Bed, Users, Bath, Wind, Wifi, Droplets, Tv } from 'lucide-react';
import { useBooking } from '@/context/BookingContext';
import { getImageUrl } from '@/lib/siteImages';
import { lodgingText, lodgingPrice, type Lodging } from '@/lib/lodgings';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

export default function RoomsClient({ siteImages, lodgings, lang }: { siteImages: any; lodgings: Lodging[] | null; lang: string }) {
  const { openBookingModal, openLodgingBooking } = useBooking();
  const isEn=lang==='en';
  
  const getPrimaryImage = (roomNum: number) => {
    const keys = [
      `/rooms/room${roomNum}/1.webp`,
      `/rooms/room${roomNum}/2.webp`,
      `/rooms/room${roomNum}/3.webp`,
      `/rooms/room${roomNum}/4.webp`,
      `/rooms/room${roomNum}/5.webp`
    ];
    for (const key of keys) {
      const url = getImageUrl(key, siteImages);
      if (url && url.trim() !== '') return url;
    }
    return '';
  };

  const legacyRooms = [
    {
      id: 1,
      name: 'Paso Suave | Room 1',
      desc: 'Su nombre significa "paso gentil". Es el espacio ideal para amigos, hermanos o viajeros solitarios que comparten una escapada de descanso. Un ambiente aireado con estilo minimalista, tonos calmos y un sutil toque boho.',
      details: { guests: '2', beds: '2 Individuales', bath: '1 Baño' },
      price: 'Desde $135 USD',
      img: getPrimaryImage(1),
    },
    {
      id: 2,
      name: 'Estrella | Room 2',
      desc: 'Brillante y acogedora, Estrella resplandece con un encanto íntimo y texturas costeras naturales. Es el lugar perfecto para dejar atrás el estrés y relajarse después de un día explorando las playas de Nayarit.',
      details: { guests: '2', beds: '1 Queen', bath: '1 Baño' },
      price: 'Desde $135 USD',
      img: getPrimaryImage(2),
    },
    {
      id: 3,
      name: 'La Luna | Room 3',
      desc: 'Un retiro pacífico bañado en tonos suaves y luz tenue. La Luna te invita a desconectar bajo una influencia calmante. Ideal para parejas o viajeros solitarios que buscan serenidad absoluta.',
      details: { guests: '2', beds: '1 Queen', bath: '1 Baño' },
      price: 'Desde $125 USD',
      img: getPrimaryImage(3),
    },
    {
      id: 4,
      name: 'Campo Abierto | Room 4',
      desc: 'Espaciosa y versátil. Los materiales naturales y la decoración cálida crean un refugio hogareño excelente para parejas, amigos o familias pequeñas que valoran el confort.',
      details: { guests: '3', beds: '1 Matrimonial + 1 Day Bed', bath: '1 Baño' },
      price: 'Desde $125 USD',
      img: getPrimaryImage(4),
    },
    {
      id: 5,
      name: 'Madera Viva | Room 5',
      desc: 'Nombrada así por la hermosa madera natural presente en toda la habitación. Ofrece una atmósfera tranquila y arraigada a la tierra, con detalles en piedra tallada por artesanos locales. Para quienes valoran la amplitud y la simplicidad.',
      details: { guests: '2', beds: '1 King', bath: '1 Baño' },
      price: 'Desde $165 USD',
      img: getPrimaryImage(5),
    },
    {
      id: 6,
      name: 'El Sueño del Mar | Room 6',
      desc: 'La joya de Casa Caballo Soñador. Un refugio sereno para estancias románticas o escapes conscientes. Elaborada con madera y piedra local, cuenta con espacio de oficina, sala de estar y vistas inspiradoras.',
      details: { guests: '2', beds: '1 King', bath: '1 Baño', extra: 'Jacuzzi Privado & Vista al Mar' },
      price: 'Desde $185 USD',
      img: getPrimaryImage(6),
    },
  ];

  const rooms = lodgings === null ? legacyRooms.map(r=>({...r,lodgingId:undefined as string|undefined,policy:''})) : lodgings.filter(l=>l.kind==='room').map((l,index)=>({
    id:index+1,lodgingId:l.id,name:lodgingText(l.name,lang),desc:lodgingText(l.description,lang),
    details:{guests:String(l.capacity),beds:lodgingText(l.beds,lang),bath:`${l.bathrooms} ${isEn?'bathroom(s)':'baño(s)'}`,extra:l.amenities.join(' · ')},
    price:(isEn?'From ':'Desde ')+lodgingPrice(l.fromRateMinor??l.baseRateMinor,l.currency,lang),
    img:l.photoKeys.map(key=>getImageUrl(key,siteImages)).find(Boolean)||'',policy:lodgingText(l.policy,lang),
  }));
  const whole=lodgings?.find(l=>l.kind==='whole_home');

  const heroImg = getImageUrl('/imagenes/04_about/about_casa_44.webp', siteImages);
  const rooftopImg = getImageUrl('/imagenes/05_amenities/amenity_09_rooftop_terrace.webp', siteImages);
  const poolImg = getImageUrl('/imagenes/05_amenities/amenity_02_pool_lounge.webp', siteImages);
  const kitchenImg = getImageUrl('/imagenes/05_amenities/amenity_05_guest_kitchen.webp', siteImages);

  return (
    <div className="w-full min-h-screen bg-brand-cream pt-20">
      
      {/* Hero */}
      <section className="relative h-[60vh] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <Image src={heroImg} alt="Habitaciones" fill priority className="object-cover" sizes="100vw" />
          <div className="absolute inset-0 bg-black/50"></div>
        </div>
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="relative z-10 text-center text-white px-4 max-w-3xl mx-auto"
        >
          <h1 className="text-4xl md:text-6xl mb-4 font-serif text-brand-white drop-shadow-md">{isEn?'Your stay in Chacala':'Tu estancia en Chacala'}</h1>
          <p className="text-lg md:text-2xl font-light opacity-90">Lujo Boutique y Confort Natural. Descubre un santuario de descanso diseñado para integrarse armoniosamente con el entorno.</p>
        </motion.div>
      </section>

      {whole&&<section className="max-w-7xl mx-auto px-4 pt-20"><div className="bg-white p-8 md:p-12 grid md:grid-cols-2 gap-10 items-center shadow-sm"><div><p className="text-xs tracking-[0.2em] uppercase text-[#9B7E67] mb-4">{isEn?'THE ENTIRE HOUSE, JUST FOR YOU':'TODA LA CASA, SOLO PARA TI'}</p><h2 className="text-3xl md:text-4xl font-serif mb-5">{lodgingText(whole.name,lang)}</h2><p className="text-gray-600 leading-relaxed text-lg">{lodgingText(whole.description,lang)}</p><p className="text-gray-500 my-5">{whole.capacity} {isEn?'guests':'huéspedes'} · {whole.minStay} {isEn?'nights minimum':'noches mínimo'}</p><p className="text-xl font-serif mb-6">{isEn?'From ':'Desde '}{lodgingPrice(whole.fromRateMinor??whole.baseRateMinor,whole.currency,lang)} / {isEn?'night':'noche'}</p><button onClick={()=>openLodgingBooking(whole.id)} className="bg-brand-dark text-white px-8 py-4 uppercase tracking-widest font-semibold">{isEn?'Book the entire house':'Reservar casa completa'}</button></div><div className="relative h-72 md:h-96"><Image src={whole.photoKeys.map(key=>getImageUrl(key,siteImages)).find(Boolean)||heroImg} alt={lodgingText(whole.name,lang)} fill sizes="(max-width:768px) 100vw,50vw" className="object-cover"/></div></div></section>}
      {/* Catálogo de Habitaciones */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <div className="space-y-32">
          {lodgings!==null&&rooms.length===0&&<p role="status" className="text-gray-600 text-center">{isEn?'Room information is temporarily unavailable. Please contact us to plan your stay.':'La información de habitaciones no está disponible en este momento. Contáctanos para planear tu estancia.'}</p>}
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
              <div className="relative w-full lg:w-1/2 h-[500px] lg:h-[750px] overflow-hidden shadow-2xl bg-[#EAE5DD] flex items-center justify-center">
                {room.img ? (
                  <Image src={room.img} alt={room.name} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#9B7E67] gap-3">
                    <Bed className="w-12 h-12 opacity-40" />
                    <span className="text-sm md:text-base uppercase tracking-widest font-semibold opacity-60">Imágenes próximamente</span>
                  </div>
                )}
              </div>
              <div className="w-full lg:w-1/2 space-y-6">
                <h2 className="text-3xl md:text-4xl font-serif text-brand-dark">{room.name}</h2>
                <div className="w-16 h-[2px] bg-brand-dark/20"></div>
                <p className="text-gray-600 font-light leading-relaxed text-xl md:text-2xl">
                  {room.desc}
                </p>
                <div className="grid grid-cols-2 gap-4 text-base md:text-lg text-gray-500 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2"><Users size={16} /> {room.details.guests} Huéspedes</div>
                  <div className="flex items-center gap-2"><Bed size={16} /> {room.details.beds}</div>
                  <div className="flex items-center gap-2"><Bath size={16} /> {room.details.bath}</div>
                  <div className="flex items-center gap-2"><Wind size={16} /> Aire Acond.</div>
                  <div className="flex items-center gap-2"><Wifi size={16} /> Wi-Fi</div>
                  {room.details.extra && <div className="flex items-center gap-2"><Droplets size={16} /> {room.details.extra}</div>}
                  {room.id === 7 && <div className="flex items-center gap-2"><Tv size={16} /> TV</div>}
                </div>
                {room.policy&&<details className="text-sm text-gray-500"><summary className="cursor-pointer underline underline-offset-4">{isEn?'Rules and cancellation policy':'Reglas y política de cancelación'}</summary><p className="whitespace-pre-line leading-relaxed mt-4">{room.policy}</p></details>}
                <div className="pt-4 flex flex-wrap gap-4 items-center justify-between">
                  <span className="text-xl font-serif italic text-brand-dark">{room.price} <span className="text-base md:text-lg font-sans not-italic text-gray-500">/ noche</span></span>
                  <button onClick={()=>room.lodgingId?openLodgingBooking(room.lodgingId):openBookingModal()} className="bg-brand-dark text-white px-8 py-3 uppercase tracking-widest text-sm md:text-base font-semibold hover:bg-black transition-colors">
                    {isEn?'Book this room':'Reservar habitación'}
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
          {isEn?'Choose the entire house or an individual room. Availability, minimum stays and rates are shown for each accommodation before you confirm.':'Elige la casa completa o una habitación. La disponibilidad, estancia mínima y tarifa de cada alojamiento se muestran antes de confirmar.'}
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
              <div className="relative w-full h-64 mb-6">
                <Image src={rooftopImg} alt="Rooftop" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
              </div>
              <h3 className="text-2xl font-serif mb-4">La Palapa / Rooftop</h3>
              <p className="text-gray-600 font-light text-base md:text-lg leading-relaxed">Impresionante palapa al aire libre, perfecta para yoga, meditación, masajes o una siesta. Disfruta de vistas al Océano Pacífico.</p>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="bg-white p-8 shadow-sm hover:shadow-xl transition-shadow text-center">
              <div className="relative w-full h-64 mb-6">
                <Image src={poolImg} alt="Pool" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
              </div>
              <h3 className="text-2xl font-serif mb-4">La Piscina</h3>
              <p className="text-gray-600 font-light text-base md:text-lg leading-relaxed">Un oasis tropical inmerso en la selva. Sumérgete, toma el sol y experimenta la energía vibrante de México en total privacidad.</p>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="bg-white p-8 shadow-sm hover:shadow-xl transition-shadow text-center">
              <div className="relative w-full h-64 mb-6">
                <Image src={kitchenImg} alt="Cocina" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
              </div>
              <h3 className="text-2xl font-serif mb-4">Cocina para Huéspedes</h3>
              <p className="text-gray-600 font-light text-base md:text-lg leading-relaxed">Espacio comunal totalmente equipado donde puedes preparar tus platillos y compartir experiencias culinarias, sintiéndote como en casa.</p>
            </motion.div>
          </div>
        </div>
      </section>

    </div>
  );
}

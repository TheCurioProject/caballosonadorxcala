import prisma from '@/lib/prisma';
import { Hero } from '@/components/home/Hero';
import dynamic from 'next/dynamic';

const About = dynamic(() => import('@/components/home/About').then(mod => mod.About));
const Concept = dynamic(() => import('@/components/home/Concept').then(mod => mod.Concept));
const Services = dynamic(() => import('@/components/home/Services').then(mod => mod.Services));
const Suites = dynamic(() => import('@/components/home/Suites').then(mod => mod.Suites));
const Experiences = dynamic(() => import('@/components/home/Experiences').then(mod => mod.Experiences));
const Reviews = dynamic(() => import('@/components/home/Reviews').then(mod => mod.Reviews));
const FAQ = dynamic(() => import('@/components/home/FAQ').then(mod => mod.FAQ));
const Location = dynamic(() => import('@/components/home/Location').then(mod => mod.Location));
const Footer = dynamic(() => import('@/components/home/Footer').then(mod => mod.Footer));

import { getDictionary } from '@/i18n/dictionaries';

// Removed force-dynamic for static export

export default async function Home({ params }: { params: Promise<{ lang: 'es' | 'en' | 'de' }> }) {
  const { lang } = await params;
  const safeLang = lang || 'es';
  const dict = await getDictionary(safeLang);

  // Fetch from database
  let experiences = [];
  
  try {
    experiences = await prisma.experience.findMany();
  } catch (error) {
    console.error("Failed to fetch data from Prisma", error);
  }

  const getRoom = (id: number, basePrice: number, images: string[]) => {
    const r = (dict.roomsData as any)[id.toString()];
    return {
      id,
      name: r.name,
      price: basePrice,
      description: r.description,
      images: images.map(img => `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${img}`),
      details: { guests: r.guests, beds: r.beds, bath: r.bath, ...(r.extra ? { extra: r.extra } : {}) }
    };
  };

  const rooms = [
    getRoom(1, 0, ['/imagenes/03_rooms/room1_paso_suave.webp', '/imagenes/03_rooms/room_extra_img_3549.webp']),
    getRoom(2, 0, ['/imagenes/03_rooms/room2_estrella.webp', '/imagenes/03_rooms/room_extra_img_3549.webp']),
    getRoom(3, 0, ['/imagenes/03_rooms/room3_la_luna.webp', '/imagenes/03_rooms/room_extra_img_3549.webp']),
    getRoom(4, 0, ['/imagenes/03_rooms/room4_campo_abierto.webp', '/imagenes/03_rooms/room_extra_img_3549.webp']),
    getRoom(6, 0, ['/imagenes/03_rooms/room6_madera_viva.webp', '/imagenes/03_rooms/room_extra_img_3549.webp']),
    getRoom(7, 0, ['/imagenes/03_rooms/room7_el_sueno_del_mar.webp', '/imagenes/03_rooms/room_extra_img_3549.webp'])
  ];

  if (experiences.length === 0) {
    experiences = [
      { id: 1, title: "Ojo de Agua", price: "$75 USD", description: "Orchards to a pristine cold-water spring. Uncover hidden petroglyphs.", imageUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/tour_ojo_de_agua.jpg` },
      { id: 2, title: "Molote River", price: "$90 USD", description: "Thermal inlets and refreshing downstream waters.", imageUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/tour_molote.jpg` },
      { id: 3, title: "El Capomo", price: "$90 USD", description: "Plunge pool beneath a majestic 50ft jungle waterfall.", imageUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/tour_el_capomo.jpg` },
      { id: 4, title: "Las Cuevas", price: "$80 USD", description: "Hidden gem beneath a volcanic plug for uninterrupted beach time.", imageUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/imagenes/07_tours/tour_los_cuevas.jpg` }
    ] as any;
  }

  return (
    <div className="bg-[#F9F7F4] font-sans min-h-screen antialiased selection:bg-[#9B7E67] selection:text-[#F9F7F4]">
      
      <main>
        <Hero />
        <About />
        <Concept />
        <Services />
        <Suites rooms={rooms} />
        <Experiences experiences={experiences} />
        <Reviews />
        <FAQ />
        <Location />
      </main>

      <Footer />
    </div>
  );
}

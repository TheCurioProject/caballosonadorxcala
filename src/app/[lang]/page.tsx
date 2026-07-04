import prisma from '@/lib/prisma';
import { Hero } from '@/components/home/Hero';
import dynamic from 'next/dynamic';

const About = dynamic(() => import('@/components/home/About').then(mod => mod.About));
const Suites = dynamic(() => import('@/components/home/Suites').then(mod => mod.Suites));
const Amenities = dynamic(() => import('@/components/home/Amenities').then(mod => mod.Amenities));
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

  const getRoom = (id: number, basePrice: number, video: string, downVideo?: string) => {
    const r = (dict.roomsData as any)[id.toString()];
    return {
      id,
      name: r.name,
      price: basePrice,
      description: r.description,
      videoUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${video}`,
      ...(downVideo ? { videoDownUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${downVideo}` } : {}),
      details: { guests: r.guests, beds: r.beds, bath: r.bath, ...(r.extra ? { extra: r.extra } : {}) }
    };
  };

  const rooms = [
    getRoom(1, 0, '/habitaciones/1.webm'),
    getRoom(2, 0, '/habitaciones/2.webm'),
    getRoom(3, 0, '/habitaciones/3.webm'),
    getRoom(4, 0, '/habitaciones/4.webm'),
    getRoom(6, 0, '/habitaciones/6.webm'),
    getRoom(7, 0, '/habitaciones/suite.webm', '/habitaciones/suite-down.webm')
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
        <Suites rooms={rooms} />
        <Amenities />
        <Experiences experiences={experiences} />
        <Reviews />
        <FAQ />
        <Location />
      </main>

      <Footer />
    </div>
  );
}

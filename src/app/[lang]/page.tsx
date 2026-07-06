import prisma from '@/lib/prisma';
import { Hero } from '@/components/home/Hero';
import { About } from '@/components/home/About';
import { Concept } from '@/components/home/Concept';
import { Services } from '@/components/home/Services';
import { Suites } from '@/components/home/Suites';
import { Experiences } from '@/components/home/Experiences';
import { Reviews } from '@/components/home/Reviews';
import { FAQ } from '@/components/home/FAQ';
import dynamic from 'next/dynamic';

const Location = dynamic(() => import('@/components/home/Location').then(mod => mod.Location), { ssr: true });
const Footer = dynamic(() => import('@/components/home/Footer').then(mod => mod.Footer), { ssr: true });

import { getDictionary } from '@/i18n/dictionaries';

// Removed force-dynamic for static export

export default async function Home({ params }: { params: Promise<{ lang: 'es' | 'en' }> }) {
  const { lang } = await params;
  const safeLang = lang || 'es';
  const dict = await getDictionary(safeLang);

  // Fetch from database
  let experiences = [];
  
  try {
    // Timeout prisma query after 1.5 seconds to prevent server-side hang
    const fetchExperiences = prisma.experience.findMany();
    const timeout = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Prisma timeout')), 1500));
    experiences = await Promise.race([fetchExperiences, timeout]);
  } catch (error) {
    // Next.js dev server intercepts console.error and displays a full-screen overlay.
    // Since we have a fallback for experiences, we log a warning instead.
    console.warn("Failed to fetch data from Prisma or timed out, using fallback data.");
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
    experiences = dict.toursPage.tours.map((t: any, i: number) => {
      const images = [
        '/imagenes/07_tours/tour_ojo_de_agua.webp',
        '/imagenes/07_tours/tour_molote.webp',
        '/imagenes/07_tours/tour_el_capomo.webp',
        '/imagenes/07_tours/tour_los_cuevas.webp',
        '/imagenes/07_tours/tour_ojo_de_agua.webp',
        '/imagenes/07_tours/tour_molote.webp',
        '/imagenes/07_tours/tour_el_capomo.webp'
      ];
      return {
        id: t.id,
        title: t.title,
        price: i === 0 ? "$75 USD" : (i === 3 ? "$80 USD" : "$90 USD"),
        description: t.description,
        imageUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${images[i]}`
      };
    }).slice(0, 4) as any;
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

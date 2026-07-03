import prisma from '@/lib/prisma';
import { Hero } from '@/components/home/Hero';
import { About } from '@/components/home/About';
import { Suites } from '@/components/home/Suites';
import { Amenities } from '@/components/home/Amenities';
import { Experiences } from '@/components/home/Experiences';
import { Reviews } from '@/components/home/Reviews';
import { FAQ } from '@/components/home/FAQ';
import { Location } from '@/components/home/Location';
import { Footer } from '@/components/home/Footer';

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

  const rooms = [
    { id: 1, name: "Room 1", price: 0, description: "TWIN ROOM (King-Convertible). Meaning \"gentle step\", Paso Suave is ideal for friends, siblings, or solo travelers sharing a restful escape. This airy space features two single beds, A/C, and Wi-Fi.", videoUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/habitaciones/1.webm`, details: { guests: '2', beds: '2 Individuales', bath: '1 Baño' } },
    { id: 2, name: "Room 2", price: 0, description: "Queen Room. Bright and welcoming, Estrella shines with a cozy charm and natural coastal textures. With a queen size bed, A/C, and Wi-Fi, it’s the perfect place to relax.", videoUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/habitaciones/2.webm`, details: { guests: '2', beds: '1 Queen', bath: '1 Baño' } },
    { id: 3, name: "Room 3", price: 0, description: "A peaceful retreat bathed in soft tones and gentle light, La Luna invites you to relax under the calming glow of the moon. Offers a queen-size bed, A/C, fast Wi-Fi.", videoUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/habitaciones/3.webm`, details: { guests: '2', beds: '1 Queen', bath: '1 Baño' } },
    { id: 4, name: "Room 4", price: 0, description: "Matrimonial + Day Bed. Spacious and versatile, perfect for couples, friends, or small families. Natural materials and warm decor create a cozy retreat with A/C.", videoUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/habitaciones/4.webm`, details: { guests: '2', beds: '1 Matrimonial + 1 Day Bed', bath: '1 Baño' } },
    { id: 6, name: "Room 6", price: 0, description: "KING SUITE. Named after the living wood used throughout the room, Madera Viva offers a quiet and grounded atmosphere with a king-size bed and stone accents.", videoUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/habitaciones/6.webm`, details: { guests: '2', beds: '1 King', bath: '1 Baño' } },
    { id: 7, name: "Suite El Sueño del Mar", price: 0, description: "Deluxe King Suite (Jacuzzi + Ocean View). The crown jewel featuring a king bed, office space, and lounge with TV. Crafted from local wood and stone.", videoUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/habitaciones/suite.webm`, videoDownUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/habitaciones/suite-down.webm`, details: { guests: '2', beds: '1 King', bath: '1 Baño', extra: 'Jacuzzi & Vista al Mar' } },
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

import dynamic from 'next/dynamic';
import prisma from '@/lib/prisma';
import { Hero } from '@/components/home/Hero';
import { getDictionary } from '@/i18n/dictionaries';
import { getImageUrl } from '@/lib/siteImages';
import { getSiteImages } from '@/lib/siteImages.server';

// Dynamic imports for below-the-fold components to improve initial load performance
const About = dynamic(() => import('@/components/home/About').then(mod => mod.About));
const Concept = dynamic(() => import('@/components/home/Concept').then(mod => mod.Concept));
const Services = dynamic(() => import('@/components/home/Services').then(mod => mod.Services));
const Suites = dynamic(() => import('@/components/home/Suites').then(mod => mod.Suites));
const Experiences = dynamic(() => import('@/components/home/Experiences').then(mod => mod.Experiences));
const Reviews = dynamic(() => import('@/components/home/Reviews').then(mod => mod.Reviews));
const FAQ = dynamic(() => import('@/components/home/FAQ').then(mod => mod.FAQ));
const Location = dynamic(() => import('@/components/home/Location').then(mod => mod.Location));
const Footer = dynamic(() => import('@/components/home/Footer').then(mod => mod.Footer));
const FoodServices = dynamic(() => import('@/components/home/FoodServices').then(mod => mod.FoodServices));

// Revalidate page every 60 seconds (ISR) to fix caching issues without losing performance
export const revalidate = 60;

export default async function Home({ params }: { params: Promise<{ lang: 'es' | 'en' }> }) {
  const { lang } = await params;
  const safeLang = lang || 'es';
  const dict = await getDictionary(safeLang);
  const siteImages = await getSiteImages();

  // Fetch from database
  let experiences = [];
  
  try {
    // Timeout prisma query after 8 seconds to prevent server-side hang
    const fetchExperiences = prisma.experience.findMany();
    const timeout = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Prisma timeout')), 8000));
    experiences = await Promise.race([fetchExperiences, timeout]);
  } catch (error) {
    // Next.js dev server intercepts console.error and displays a full-screen overlay.
    // Since we have a fallback for experiences, we log a warning instead.
    console.warn("Failed to fetch data from Prisma or timed out, using fallback data.");
  }

  const getRoom = (id: number, basePrice: number, imageKeys: string[]) => {
    const r = (dict.roomsData as any)[id.toString()];
    const resolvedImages = imageKeys
      .map(img => getImageUrl(img, siteImages))
      .filter(url => url && url.trim() !== '');

    return {
      id,
      name: r.name,
      price: basePrice,
      description: r.description,
      shortDescription: r.shortDescription,
      images: resolvedImages,
      details: { guests: r.guests, beds: r.beds, bath: r.bath, ...(r.extra ? { extra: r.extra } : {}) }
    };
  };

  const rooms = [
    getRoom(1, 0, ['/rooms/room1/1.webp', '/rooms/room1/2.webp', '/rooms/room1/3.webp', '/rooms/room1/4.webp', '/rooms/room1/5.webp']),
    getRoom(2, 0, ['/rooms/room2/1.webp', '/rooms/room2/2.webp', '/rooms/room2/3.webp', '/rooms/room2/4.webp', '/rooms/room2/5.webp']),
    getRoom(3, 0, ['/rooms/room3/1.webp', '/rooms/room3/2.webp', '/rooms/room3/3.webp', '/rooms/room3/4.webp', '/rooms/room3/5.webp']),
    getRoom(4, 0, ['/rooms/room4/1.webp', '/rooms/room4/2.webp', '/rooms/room4/3.webp', '/rooms/room4/4.webp', '/rooms/room4/5.webp']),
    getRoom(5, 0, ['/rooms/room5/1.webp', '/rooms/room5/2.webp', '/rooms/room5/3.webp', '/rooms/room5/4.webp', '/rooms/room5/5.webp']),
    getRoom(6, 0, ['/rooms/room6/1.webp', '/rooms/room6/2.webp', '/rooms/room6/3.webp', '/rooms/room6/4.webp', '/rooms/room6/5.webp', '/rooms/room7/1.webp'])
  ];

  if (experiences.length === 0) {
    experiences = dict.toursPage.tours.map((t: any, i: number) => {
      const images = [
        '/tours_gallery/01_ojo_de_agua/00_ojoagua_002.webp',
        '/tours_gallery/02_molote_river/00_molote_002.webp',
        '/tours_gallery/03_el_capomo/00_capomof001.webp',
        '/tours_gallery/04_las_cuevas/01_loscuevas016.webp',
        '/tours_gallery/05_jamurrca/00_jumurrca001.webp',
        '/tours_gallery/06_alta_vista/00_altavista_002.webp',
        '/tours_gallery/07_volcano/00_sunset_019.webp'
      ];
      return {
        id: t.id,
        title: t.title,
        price: i === 0 ? "$75 USD" : (i === 3 ? "$80 USD" : "$90 USD"),
        description: t.description,
        imageUrl: getImageUrl(images[i], siteImages)
      };
    }).slice(0, 4) as any;
  }

  return (
    <div className="bg-[#F9F7F4] font-sans min-h-screen antialiased selection:bg-[#9B7E67] selection:text-[#F9F7F4]">
      
      <main>
        <Hero imageSrc={getImageUrl('/casaexterior.webp', siteImages)} />
        <About imageSrc={getImageUrl('/casaestancia.webp', siteImages)} />
        <Concept imageSrc={getImageUrl('/imagenes/02_hero/hero_01_img_4885.webp', siteImages)} />
        <Suites rooms={rooms} />
        <Services imageSrc={getImageUrl('/casacuartos.webp', siteImages)} siteImages={siteImages} />
        <FoodServices />
        <Experiences experiences={experiences} />
        <Reviews />
        <FAQ />
        <Location />
      </main>

      <Footer />
    </div>
  );
}

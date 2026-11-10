import nextDynamic from 'next/dynamic';
import prisma from '@/lib/prisma';
import { Hero } from '@/components/home/Hero';
import { getDictionary } from '@/i18n/dictionaries';
import { getImageUrl } from '@/lib/siteImages';
import { getSiteImages } from '@/lib/siteImages.server';
import { getLodgings } from '@/lib/lodgings.server';
import { calaConfiguration } from '@/lib/cala/config';
import { lodgingPrice, lodgingText } from '@/lib/lodgings';

import { unstable_cache } from 'next/cache';
import { stripe } from '@/lib/stripe';

const getCachedExperiences = unstable_cache(
  async () => {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      // Reduced timeout to 4 seconds to prevent server-side hang
      const fetchExperiences = prisma.experience.findMany();
      const timeout = new Promise<any[]>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Prisma timeout')), 4000);
      });
      return await Promise.race([fetchExperiences, timeout]);
    } catch (error) {
      console.warn("Failed to fetch data from Prisma or timed out, using fallback data.");
      return [];
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  },
  ['experiences'],
  { revalidate: 3600, tags: ['experiences'] }
);

const getCachedAmenities = unstable_cache(
  async () => {
    try {
      return await prisma.stayAmenity.findMany({ orderBy: { id: 'asc' } });
    } catch (error) {
      console.warn("Failed to fetch amenities");
      return [];
    }
  },
  ['stay-amenities'],
  { revalidate: 3600, tags: ['amenities'] }
);

// Dynamic imports for below-the-fold components to improve initial load performance
const About = nextDynamic(() => import('@/components/home/About').then(mod => mod.About));
const Concept = nextDynamic(() => import('@/components/home/Concept').then(mod => mod.Concept));
const Services = nextDynamic(() => import('@/components/home/Services').then(mod => mod.Services));
const Suites = nextDynamic(() => import('@/components/home/Suites').then(mod => mod.Suites));
const Experiences = nextDynamic(() => import('@/components/home/Experiences').then(mod => mod.Experiences));
const Reviews = nextDynamic(() => import('@/components/home/Reviews').then(mod => mod.Reviews));
const FAQ = nextDynamic(() => import('@/components/home/FAQ').then(mod => mod.FAQ));
const Location = nextDynamic(() => import('@/components/home/Location').then(mod => mod.Location));
const Footer = nextDynamic(() => import('@/components/home/Footer').then(mod => mod.Footer));
const FoodServices = nextDynamic(() => import('@/components/home/FoodServices').then(mod => mod.FoodServices));

import { BookingSuccessModal } from '@/components/home/BookingSuccessModal';

// Revalidate page every 60 seconds (ISR) to fix caching issues without losing performance
export const dynamic = 'force-dynamic';

export default async function Home({ params, searchParams }: { params: Promise<{ lang: 'es' | 'en' }>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { lang } = await params;
  const search = await searchParams;
  const safeLang = lang || 'es';
  const dict = await getDictionary(safeLang);
  const [siteImages, catalog] = await Promise.all([getSiteImages(), calaConfiguration().ready ? getLodgings().catch(()=>[]) : Promise.resolve(null)]);

  let bookingSuccessData = null;
  if (search.success === 'true' && typeof search.booking_id === 'string' && typeof search.session_id === 'string') {
    try {
      const session = await stripe.checkout.sessions.retrieve(search.session_id);
      if (['paid', 'no_payment_required'].includes(session.payment_status) && session.metadata?.bookingId === search.booking_id) {
        const id = Number(search.booking_id);
        if (Number.isSafeInteger(id) && id > 0) {
          bookingSuccessData = await prisma.booking.findUnique({
            where: { id },
            select: { id: true, guestName: true, guestEmail: true, checkIn: true, checkOut: true, totalPrice: true, payment_status: true },
          });
        }
      }
    } catch (error) {
      console.error('[Home] Payment verification failed', error);
    }
  }

  // Fetch from database using Next.js cache
  let experiences = await getCachedExperiences();
  const amenities = await getCachedAmenities();

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

  const legacyRooms = [
    getRoom(1, 0, ['/rooms/room1/1.webp', '/rooms/room1/2.webp', '/rooms/room1/3.webp', '/rooms/room1/4.webp', '/rooms/room1/5.webp']),
    getRoom(2, 0, ['/rooms/room2/1.webp', '/rooms/room2/2.webp', '/rooms/room2/3.webp', '/rooms/room2/4.webp', '/rooms/room2/5.webp']),
    getRoom(3, 0, ['/rooms/room3/1.webp', '/rooms/room3/2.webp', '/rooms/room3/3.webp', '/rooms/room3/4.webp', '/rooms/room3/5.webp']),
    getRoom(4, 0, ['/rooms/room4/1.webp', '/rooms/room4/2.webp', '/rooms/room4/3.webp', '/rooms/room4/4.webp', '/rooms/room4/5.webp']),
    getRoom(5, 0, ['/rooms/room5/1.webp', '/rooms/room5/2.webp', '/rooms/room5/3.webp', '/rooms/room5/4.webp', '/rooms/room5/5.webp']),
    getRoom(6, 0, ['/rooms/room6/1.webp', '/rooms/room6/2.webp', '/rooms/room6/3.webp', '/rooms/room6/4.webp', '/rooms/room6/5.webp'])
  ];

  const rooms = catalog === null ? legacyRooms : catalog.filter(l=>l.kind==='room').map((l,index)=>({
    id:index+1,lodgingId:l.id,name:lodgingText(l.name,safeLang),price:(safeLang==='en'?'From ':'Desde ')+lodgingPrice(l.fromRateMinor??l.baseRateMinor,l.currency,safeLang)+(safeLang==='en'?' / night':' / noche'),
    description:lodgingText(l.description,safeLang),shortDescription:lodgingText(l.description,safeLang),
    images:l.photoKeys.map(key=>getImageUrl(key,siteImages)).filter(Boolean),
    details:{guests:l.capacity,beds:lodgingText(l.beds,safeLang),bath:l.bathrooms,extra:l.amenities.join(' · ')},
  }));

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
      
      {bookingSuccessData && <BookingSuccessModal booking={bookingSuccessData as any} lang={safeLang} />}

      <main>
        <Hero imageSrc={getImageUrl('/casaexterior.webp', siteImages)} />
        <About imageSrc={getImageUrl('/casaestancia.webp', siteImages)} />
        <Concept imageSrc={getImageUrl('/imagenes/02_hero/hero_01_img_4885.webp', siteImages)} />
        <Suites rooms={rooms} />
        <Services imageSrc={getImageUrl('/casacuartos.webp', siteImages)} siteImages={siteImages} amenities={amenities} lang={safeLang} />
        <FoodServices />
        <Experiences experiences={experiences} />
        <Reviews />
        <FAQ lodgingSummary={catalog ? {capacity:catalog.find(l=>l.kind==='whole_home')?.capacity,roomCount:catalog.filter(l=>l.kind==='room').length} : undefined} />
        <Location />
      </main>

      <Footer />
    </div>
  );
}

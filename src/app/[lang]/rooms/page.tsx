import type { Metadata } from 'next';
import { getSiteImages } from '@/lib/siteImages.server';

export const dynamic = 'force-dynamic';
import { getLodgings } from '@/lib/lodgings.server';
import { calaConfiguration } from '@/lib/cala/config';
import RoomsClient from './RoomsClient';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const siteUrl = 'https://casadelcaballosonador.com';
  return {
    title: lang === 'en' ? 'Rooms | Casa Caballo Soñador' : 'Habitaciones | Casa Caballo Soñador',
    alternates: {
      canonical: `${siteUrl}/${lang}/rooms/`,
      languages: { es: `${siteUrl}/es/rooms/`, en: `${siteUrl}/en/rooms/`, 'x-default': `${siteUrl}/es/rooms/` },
    },
  };
}

export default async function RoomsPage({params}: {params: Promise<{lang:string}>}) {
  const {lang}=await params;
  const [siteImages,lodgings] = await Promise.all([getSiteImages(),calaConfiguration().ready ? getLodgings().catch(()=>[]) : Promise.resolve(null)]);
  return <RoomsClient siteImages={siteImages} lodgings={lodgings} lang={lang} />;
}

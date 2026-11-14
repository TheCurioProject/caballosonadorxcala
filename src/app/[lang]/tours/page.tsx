import { getSiteImages } from '@/lib/siteImages.server';
import { getDictionary } from '@/i18n/dictionaries';
import { listTours } from '@/lib/tours.server';
import type { Metadata } from 'next';

export const revalidate = 60;

const siteUrl = 'https://casadelcaballosonador.com';

export async function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }];
}

export async function generateMetadata({ params }: { params: Promise<{ lang: 'es' | 'en' }> }): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang || 'es');
  const tours = (dict as any).toursPage;

  const title = lang === 'en'
    ? 'ATV Tours & Experiences in Chacala'
    : 'ATV Tours y Experiencias en Chacala';
  const description = lang === 'en'
    ? 'Discover the best ATV tours and nature experiences in Chacala, Nayarit. Explore hidden cenotes, jungle trails, and Pacific sunsets from Casa Caballo Soñador.'
    : 'Descubre los mejores tours en ATV y experiencias en la naturaleza de Chacala, Nayarit. Explora cenotes escondidos, senderos en la selva y atardeceres del Pacífico.';

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/${lang}/tours/`,
      languages: {
        'es': `${siteUrl}/es/tours/`,
        'en': `${siteUrl}/en/tours/`,
        'x-default': `${siteUrl}/es/tours/`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${lang}/tours/`,
      siteName: 'Casa Caballo Soñador',
      images: [{
        url: 'https://res.cloudinary.com/p6nhvksw/image/upload/v1784743742/hotelsonador/casaexterior.webp',
        width: 1200,
        height: 630,
        alt: title,
      }],
      locale: lang === 'es' ? 'es_MX' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

import ToursClient from './ToursClient';

export default async function ToursPage({ params }: { params: Promise<{ lang: 'es' | 'en' }> }) {
  const { lang } = await params;
  // Tours are managed in CALA → ATV Tours. Until that content exists in the
  // database (or if it cannot be read) the page keeps its built-in copy.
  const [siteImages, dbTours] = await Promise.all([
    getSiteImages(),
    listTours({ activeOnly: true }).catch(() => null),
  ]);

  return <ToursClient lang={lang} siteImages={siteImages} dbTours={dbTours} />;
}


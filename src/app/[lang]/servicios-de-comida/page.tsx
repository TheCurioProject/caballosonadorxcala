import { getSiteImages } from '@/lib/siteImages.server';
import type { Metadata } from 'next';

export const revalidate = 60;

const siteUrl = 'https://casadelcaballosonador.com';

export async function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }];
}

export async function generateMetadata({ params }: { params: Promise<{ lang: 'es' | 'en' }> }): Promise<Metadata> {
  const { lang } = await params;
  const safeLang = lang || 'es';

  const title = safeLang === 'en'
    ? 'Food Services | Private Chef & Dinner Service'
    : 'Servicios de Comida | Chef Privado y Servicio de Cena';
  const description = safeLang === 'en'
    ? 'Enjoy personalized culinary service at Casa Caballo Soñador. Request a private chef, dinner service, or personal kitchen assistant during your stay in Chacala, Nayarit.'
    : 'Disfruta de servicio culinario personalizado en Casa Caballo Soñador. Solicita un chef privado, servicio de cena o asistente de cocina durante tu estancia en Chacala, Nayarit.';

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/${safeLang}/servicios-de-comida/`,
      languages: {
        'es': `${siteUrl}/es/servicios-de-comida/`,
        'en': `${siteUrl}/en/servicios-de-comida/`,
        'x-default': `${siteUrl}/es/servicios-de-comida/`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${safeLang}/servicios-de-comida/`,
      siteName: 'Casa Caballo Soñador',
      images: [{
        url: 'https://res.cloudinary.com/p6nhvksw/image/upload/v1784743737/hotelsonador/DSC_0226.webp',
        width: 1200,
        height: 630,
        alt: title,
      }],
      locale: safeLang === 'es' ? 'es_MX' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

import ServiciosDeComidaClient from './ServiciosDeComidaClient';

export default async function ServiciosDeComidaPage({ params }: { params: Promise<{ lang: 'es' | 'en' }> }) {
  const siteImages = await getSiteImages();
  
  return <ServiciosDeComidaClient siteImages={siteImages} />;
}


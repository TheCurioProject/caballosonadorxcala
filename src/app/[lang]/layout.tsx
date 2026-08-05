import { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';

export async function generateStaticParams() {
  return [{ lang: 'es' }, { lang: 'en' }];
}

export async function generateMetadata({ params }: { params: Promise<{ lang: 'es' | 'en' }> }): Promise<Metadata> {
  const { lang } = await params;
  const safeLang = lang || 'es';
  const dict = await getDictionary(safeLang);
  
  const siteUrl = 'https://casadelcaballosonador.com';

  const keywords = safeLang === 'es'
    ? 'hotel boutique Chacala, Nayarit, Casa Caballo Soñador, renta de villa México, retiro lujo Pacífico, alojamiento exclusivo Riviera Nayarit, hotel privado Chacala, hospedaje Nayarit naturaleza'
    : 'boutique hotel Chacala Nayarit, Casa Caballo Sonador, luxury villa rental Mexico, Pacific coast retreat, exclusive accommodation Riviera Nayarit, private hotel Chacala, Nayarit nature lodge';

  return {
    title: `Casa Caballo Soñador | ${dict.hero.reserve}`,
    description: dict.about.p1,
    keywords,
    alternates: {
      canonical: `${siteUrl}/${lang}/`,
      languages: {
        'es': `${siteUrl}/es/`,
        'en': `${siteUrl}/en/`,
        'x-default': `${siteUrl}/es/`,
      },
    },
    openGraph: {
      title: `Casa Caballo Soñador | ${dict.hero.reserve}`,
      description: dict.about.p1,
      url: `${siteUrl}/${safeLang}/`,
      siteName: 'Casa Caballo Soñador',
      images: [
        {
          url: 'https://res.cloudinary.com/p6nhvksw/image/upload/v1784743742/hotelsonador/casaexterior.webp',
          width: 1200,
          height: 630,
          alt: 'Casa Caballo Soñador — Hotel Boutique en Chacala, Nayarit',
          type: 'image/webp',
        },
      ],
      locale: safeLang === 'es' ? 'es_MX' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Casa Caballo Soñador | ${dict.hero.reserve}`,
      description: dict.about.p1,
      images: ['https://res.cloudinary.com/p6nhvksw/image/upload/v1784743742/hotelsonador/casaexterior.webp'],
    },
  };
}

import { DictionaryProvider } from '@/i18n/DictionaryContext';

// JSON-LD schemas for Hotel and LocalBusiness rich results
const hotelSchema = {
  '@context': 'https://schema.org',
  '@type': 'LodgingBusiness',
  name: 'Casa Caballo Soñador',
  description: 'An exclusive full-rental boutique casa designed for deep rest, natural connection, and unforgettable retreats in the Riviera Nayarit, Mexico.',
  url: 'https://casadelcaballosonador.com',
  telephone: '+12509612351',
  email: 'kelli9@telus.net',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '13 Ecuador',
    addressLocality: 'Chacala',
    addressRegion: 'Nayarit',
    postalCode: '63715',
    addressCountry: 'MX',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 21.167145,
    longitude: -105.22340,
  },
  numberOfRooms: 6,
  starRating: {
    '@type': 'Rating',
    ratingValue: 5,
  },
  priceRange: '$$$',
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'Swimming Pool', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Wi-Fi', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Air Conditioning', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Private Kitchen', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Rooftop Terrace', value: true },
  ],
  image: [
    'https://res.cloudinary.com/p6nhvksw/image/upload/v1784743742/hotelsonador/casaexterior.webp',
    'https://res.cloudinary.com/p6nhvksw/image/upload/v1784743740/hotelsonador/casaestancia.webp',
    'https://res.cloudinary.com/p6nhvksw/image/upload/v1784743743/hotelsonador/casacuartos.webp',
  ],
  sameAs: [
    'https://www.instagram.com/casacaballosonador/',
    'https://www.facebook.com/AlexandKelliMexico/',
  ],
  hasMap: 'https://maps.app.goo.gl/DLkrnoaMf2p9TynEA',
  tourBookingPage: 'https://casadelcaballosonador.com/es/',
};

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const safeLang = (lang as 'es' | 'en') || 'es';
  const dict = await getDictionary(safeLang);

  return (
    <DictionaryProvider dict={dict}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hotelSchema) }}
      />
      {children}
    </DictionaryProvider>
  );
}


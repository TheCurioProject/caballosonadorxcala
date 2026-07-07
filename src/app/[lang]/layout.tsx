import { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';

export async function generateMetadata({ params }: { params: Promise<{ lang: 'es' | 'en' }> }): Promise<Metadata> {
  const { lang } = await params;
  const safeLang = lang || 'es';
  const dict = await getDictionary(safeLang);
  
  const siteUrl = 'https://casadelcaballosonador.com';

  return {
    title: `Casa Caballo Soñador | ${dict.hero.reserve}`,
    description: dict.about.p1,
    alternates: {
      canonical: `${siteUrl}/${lang}`,
      languages: {
        'es': `${siteUrl}/es`,
        'en': `${siteUrl}/en`,
      },
    },
    openGraph: {
      title: `Casa Caballo Soñador | ${dict.hero.reserve}`,
      description: dict.about.p1,
      url: `${siteUrl}/${safeLang}`,
      siteName: 'Casa Caballo Soñador',
      images: [
        {
          url: `${siteUrl}/imagenes/04_about/DSC_0300.JPG`,
          width: 1200,
          height: 630,
          alt: 'Casa Caballo Soñador',
        },
      ],
      locale: safeLang === 'es' ? 'es_MX' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Casa Caballo Soñador | ${dict.hero.reserve}`,
      description: dict.about.p1,
      images: [`${siteUrl}/imagenes/04_about/DSC_0300.JPG`],
    },
  };
}

import { DictionaryProvider } from '@/i18n/DictionaryContext';

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
      {children}
    </DictionaryProvider>
  );
}

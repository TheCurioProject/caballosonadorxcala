import { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';

export async function generateMetadata({ params }: { params: Promise<{ lang: 'es' | 'en' | 'de' }> }): Promise<Metadata> {
  const { lang } = await params;
  const safeLang = lang || 'es';
  const dict = await getDictionary(safeLang);
  
  const siteUrl = 'https://casadelcaballosonador.com';

  return {
    title: `Casa del Caballo Soñador | ${dict.hero.reserve}`,
    description: dict.about.p1,
    alternates: {
      canonical: `${siteUrl}/${lang}`,
      languages: {
        'es': `${siteUrl}/es`,
        'en': `${siteUrl}/en`,
        'de': `${siteUrl}/de`,
      },
    },
    openGraph: {
      title: `Casa del Caballo Soñador | ${dict.hero.reserve}`,
      description: dict.about.p1,
      url: `${siteUrl}/${safeLang}`,
      siteName: 'Casa del Caballo Soñador',
      images: [
        {
          url: `${siteUrl}/imagenes/04_about/DSC_0300.JPG`,
          width: 1200,
          height: 630,
          alt: 'Casa del Caballo Soñador',
        },
      ],
      locale: safeLang === 'es' ? 'es_MX' : safeLang === 'de' ? 'de_DE' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Casa del Caballo Soñador | ${dict.hero.reserve}`,
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
  const safeLang = (lang as 'es' | 'en' | 'de') || 'es';
  const dict = await getDictionary(safeLang);

  return (
    <DictionaryProvider dict={dict}>
      {children}
    </DictionaryProvider>
  );
}

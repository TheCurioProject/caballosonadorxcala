import { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';

export async function generateMetadata({ params }: { params: { lang: 'es' | 'en' | 'de' } }): Promise<Metadata> {
  const lang = params.lang || 'es';
  const dict = await getDictionary(lang);
  
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
      url: `${siteUrl}/${lang}`,
      siteName: 'Casa del Caballo Soñador',
      images: [
        {
          url: `${siteUrl}/imagenes/04_about/DSC_0300.JPG`,
          width: 1200,
          height: 630,
          alt: 'Casa del Caballo Soñador',
        },
      ],
      locale: lang === 'es' ? 'es_MX' : lang === 'de' ? 'de_DE' : 'en_US',
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
  params: { lang: string };
}) {
  const lang = (params.lang as 'es' | 'en' | 'de') || 'es';
  const dict = await getDictionary(lang);

  return (
    <DictionaryProvider dict={dict}>
      {children}
    </DictionaryProvider>
  );
}

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { RetreatCard } from '@/components/retreats/RetreatCard';
import { listRetreats, retreatOffers } from '@/lib/retreats.server';
import { retreatFromTotal, retreatRemaining } from '@/lib/retreats';

export const dynamic = 'force-dynamic';

const siteUrl = 'https://casadelcaballosonador.com';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const title = lang === 'en' ? 'Retreats | Casa Caballo Soñador' : 'Retiros | Casa Caballo Soñador';
  return {
    title,
    alternates: {
      canonical: `${siteUrl}/${lang}/retiros/`,
      languages: { es: `${siteUrl}/es/retiros/`, en: `${siteUrl}/en/retiros/`, 'x-default': `${siteUrl}/es/retiros/` },
    },
    openGraph: { title, url: `${siteUrl}/${lang}/retiros/`, siteName: 'Casa Caballo Soñador', locale: lang === 'en' ? 'en_US' : 'es_MX', type: 'website' },
  };
}

/** Local date in Chacala (America/Mazatlan): a retreat is listed until it ends. */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mazatlan' }).format(new Date());

export default async function RetreatsPage(props: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await props.params;
  const lang = raw === 'en' ? 'en' : 'es';
  const [retreats, offers] = await Promise.all([
    listRetreats({ activeOnly: true }).catch(() => []),
    retreatOffers().catch(() => []),
  ]);
  const now = today();
  const visible = retreats.filter(r => !r.endsOn || r.endsOn > now);

  return (
    <main className="min-h-screen bg-[#F9F7F4] pt-24 md:pt-32 pb-20 relative">
      <nav className="fixed top-0 w-full z-[100] bg-transparent pointer-events-none">
        <div className="py-5 md:py-6">
          <div className="max-w-[1400px] mx-auto px-6 md:px-16 flex justify-between items-center">
            <Link
              href={`/${lang}`}
              className="pointer-events-auto tap-zone group flex items-center gap-3 hover:opacity-70 transition-opacity duration-300"
              aria-label={lang === 'en' ? 'BACK TO HOME' : 'VOLVER AL INICIO'}
            >
              <ArrowLeft strokeWidth={1.5} className="w-5 h-5 md:w-6 md:h-6 text-[#2C2927] transform group-hover:-translate-x-1 transition-transform" />
              <span className="hidden md:block uppercase tracking-[0.2em] text-sm md:text-base font-bold text-[#2C2927]">
                {lang === 'en' ? 'HOME' : 'INICIO'}
              </span>
            </Link>
            <div className="pointer-events-auto flex items-center gap-2">
              {(['es', 'en'] as const).map(l => (
                <Link
                  key={l}
                  href={`/${l}/retiros`}
                  className={`tap-zone flex flex-col items-center justify-center transition-all duration-300 py-1 ${lang === l ? 'opacity-100 scale-110 font-bold' : 'opacity-40 hover:opacity-100 font-medium'}`}
                >
                  <span className="text-base md:text-lg text-[#2C2927] leading-none block tracking-widest">{l.toUpperCase()}</span>
                  <span className="h-1.5 mt-1 w-full flex justify-center items-center">
                    {lang === l && <span className="w-1.5 h-1.5 rounded-full bg-[#9B7E67] shadow-sm" />}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-12">
        <header className="text-center mb-12 md:mb-20 mt-8">
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-[#2C2927] tracking-tight">
            {lang === 'en' ? 'Retreats' : 'Retiros'}
          </h1>
          <div className="w-24 h-px bg-[#9B7E67]/50 mx-auto mt-8" />
        </header>

        {visible.length > 0 ? (
          <div className="flex flex-col gap-6">
            {visible.map(retreat => {
              const offer = offers.find(o => o.id === retreat.id);
              return (
                <RetreatCard
                  key={retreat.id}
                  retreat={retreat}
                  lang={lang}
                  onSale={Boolean(offer?.onSale)}
                  remaining={retreatRemaining(retreat, offer)}
                  fromMinor={retreatFromTotal(retreat, offer)}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-center text-[#2C2927]/50 font-light text-lg">
            {lang === 'en' ? 'No retreats scheduled right now.' : 'No hay retiros programados por ahora.'}
          </p>
        )}
      </div>
    </main>
  );
}

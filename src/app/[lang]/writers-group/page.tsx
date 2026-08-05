import React from 'react';
import prisma from '@/lib/prisma';
import { WorkshopAccordion } from '@/components/writers-group/WorkshopAccordion';
import { Feather, BookOpen, Coffee, Users, Calendar, ArrowLeft } from 'lucide-react';
import { getDictionary } from '@/i18n/dictionaries';
import Link from 'next/link';

const siteUrl = 'https://casadelcaballosonador.com';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const isEn = lang === 'en';

  const title = isEn ? 'Chacala Writers Group | Writing Workshops in Mexico' : 'Chacala Writers Group | Talleres de Escritura en México';
  const description = isEn
    ? 'Join small group writing workshops and Word Church every Sunday in Chacala, Nayarit. Writers of all disciplines welcome at Casa Caballo Soñador.'
    : 'Únete a talleres de escritura en grupos pequeños y Word Church cada domingo en Chacala, Nayarit. Escritores de todas las disciplinas bienvenidos en Casa Caballo Soñador.';

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/${lang}/writers-group/`,
      languages: {
        'es': `${siteUrl}/es/writers-group/`,
        'en': `${siteUrl}/en/writers-group/`,
        'x-default': `${siteUrl}/es/writers-group/`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${lang}/writers-group/`,
      siteName: 'Casa Caballo Soñador',
      images: [{
        url: 'https://res.cloudinary.com/p6nhvksw/image/upload/v1784743742/hotelsonador/casaexterior.webp',
        width: 1200,
        height: 630,
        alt: title,
      }],
      locale: isEn ? 'en_US' : 'es_MX',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function WritersGroupPage(props: { params: Promise<{ lang: string }> }) {
  const { lang } = await props.params;
  
  // Fetch active workshops
  const workshops = await prisma.writersWorkshop.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  });

  const property = await prisma.property.findFirst();
  const whatsappNumber = property?.whatsappNumber || '+521234567890';

  return (
    <main className="min-h-screen bg-[#F9F7F4] pt-24 md:pt-32 pb-20 relative">
      
      {/* Floating Navigation */}
      <nav className="fixed top-0 w-full z-[100] bg-transparent text-[#F9F7F4] pointer-events-none transition-all duration-300">
        <div className="py-5 md:py-6">
          <div className="max-w-[1400px] mx-auto px-6 md:px-16 grid grid-cols-3 items-center relative">
            
            <div className="flex justify-start pointer-events-auto">
              <Link 
                href={`/${lang}`}
                className="group flex items-center gap-3 hover:opacity-70 transition-opacity duration-300"
                aria-label={lang === 'en' ? 'BACK TO HOME' : 'VOLVER AL INICIO'}
              >
                <ArrowLeft strokeWidth={1.5} className="w-5 h-5 md:w-6 md:h-6 text-[#2C2927] transform group-hover:-translate-x-1 transition-transform" />
                <span className="hidden md:block uppercase tracking-[0.2em] text-sm md:text-base font-bold text-[#2C2927]">
                  {lang === 'en' ? 'HOME' : 'INICIO'}
                </span>
              </Link>
            </div>

            <div className="hidden md:flex justify-center pointer-events-auto">
              {/* Optional centered logo or text can go here */}
            </div>
            <div className="md:hidden"></div>

            <div className="flex justify-end items-center pointer-events-auto gap-4 relative">
              <div className="flex items-center gap-2">
                {['es', 'en'].map((l) => {
                  const isActive = lang === l;
                  return (
                    <Link 
                      key={l}
                      href={`/${l}/writers-group`}
                      prefetch={true}
                      className={`relative flex flex-col items-center justify-center transition-all duration-300 ease-out py-1 ${
                        isActive ? 'opacity-100 scale-110 font-bold' : 'opacity-40 hover:opacity-100 font-medium'
                      }`}
                    >
                      <span className="text-base md:text-lg text-[#2C2927] leading-none block tracking-widest">{l.toUpperCase()}</span>
                      <div className="h-1.5 mt-1 w-full flex justify-center items-center">
                        {isActive && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#9B7E67] shadow-sm" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </nav>

      <div className="max-w-[1200px] mx-auto px-6 md:px-12">
        {/* Header Section */}
        <div className="text-center mb-16 md:mb-24 mt-8">
          <div className="flex justify-center mb-6 opacity-80">
            <Feather size={40} className="text-[#9B7E67]" strokeWidth={1} />
          </div>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-[#2C2927] tracking-tight mb-8">
            Chacala Writers Group
          </h1>
          <div className="w-24 h-px bg-[#9B7E67]/50 mx-auto mb-10"></div>
          
          {/* Editorial Introduction Text */}
          <div className="max-w-3xl mx-auto space-y-6 text-lg md:text-xl text-[#2C2927]/80 font-light leading-relaxed">
            <p className="flex items-start gap-4 text-left">
              <BookOpen className="flex-shrink-0 mt-1 text-[#9B7E67] opacity-60" size={24} strokeWidth={1.5} />
              <span>{lang === 'en' ? 'Chacala Writers Group offers small group writing workshops designed to get you writing. Instructors provide prompts and exercises, helping you brainstorm new ideas and build consistent writing habits.' : 'Chacala Writers Group ofrece talleres de escritura en grupos pequeños diseñados para ponerte a escribir. Los instructores proporcionan ejercicios y sugerencias que te ayudarán a generar nuevas ideas y construir hábitos de escritura consistentes.'}</span>
            </p>
            
            <p className="flex items-start gap-4 text-left">
              <Users className="flex-shrink-0 mt-1 text-[#9B7E67] opacity-60" size={24} strokeWidth={1.5} />
              <span>{lang === 'en' ? 'Are you looking to connect with a local in-person group while in Chacala? Chacala Writers Group hosts Word Church every Sunday from November to April. Writers of all disciplines are welcome.' : '¿Buscas conectarte con un grupo presencial local mientras estás en Chacala? Chacala Writers Group organiza Word Church cada domingo de noviembre a abril. Escritores de todas las disciplinas son bienvenidos.'}</span>
            </p>
            
            <p className="flex items-start gap-4 text-left">
              <Coffee className="flex-shrink-0 mt-1 text-[#9B7E67] opacity-60" size={24} strokeWidth={1.5} />
              <span>{lang === 'en' ? 'Drop in and have a coffee. Share your work, receive feedback, or explore topics.' : 'Visítanos y tómate un café. Comparte tu trabajo, recibe retroalimentación o explora nuevos temas.'}</span>
            </p>
            
            <div className="bg-[#9B7E67]/5 p-8 rounded-2xl mt-12 border border-[#9B7E67]/10 text-center">
              <Calendar className="mx-auto mb-4 text-[#9B7E67]" size={32} strokeWidth={1} />
              <p className="font-serif text-2xl md:text-3xl text-[#2C2927] mb-2">{lang === 'en' ? 'Word Church meets every Sunday' : 'Word Church se reúne todos los domingos'}</p>
              <p className="text-base md:text-lg tracking-wide uppercase text-[#2C2927]/60 font-medium">{lang === 'en' ? 'Between 9 and 11 at Casa Pacifica' : 'De 9 a 11 am en Casa Pacífica'}</p>
              <p className="mt-6 font-serif italic text-xl text-[#9B7E67]">{lang === 'en' ? 'Come have coffee.' : 'Ven a tomar un café.'}</p>
            </div>
          </div>
        </div>

        {/* Workshops Section */}
        {workshops.length > 0 && (
          <div className="mt-24 md:mt-32">
            <h2 className="text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold text-[#9B7E67] mb-8 border-b border-[#2C2927]/10 pb-4">
              {lang === 'en' ? 'Available Workshops' : 'Talleres Disponibles'}
            </h2>
            <div className="flex flex-col gap-6">
              {workshops.map(workshop => (
                <WorkshopAccordion key={workshop.id} workshop={workshop as any} lang={lang as 'es'|'en'} whatsappNumber={whatsappNumber} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

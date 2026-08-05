import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import type { Metadata } from 'next';

const siteUrl = 'https://casadelcaballosonador.com';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const isEn = lang === 'en';
  return {
    title: isEn ? 'Policies & Conditions' : 'Políticas y Condiciones',
    description: isEn
      ? 'Reservation and cancellation policies for Casa Caballo Soñador boutique hotel in Chacala, Nayarit.'
      : 'Políticas de reservación y cancelación de Casa Caballo Soñador en Chacala, Nayarit.',
    robots: { index: false, follow: false },
    alternates: {
      canonical: `${siteUrl}/${lang}/politicas/`,
      languages: {
        'es': `${siteUrl}/es/politicas/`,
        'en': `${siteUrl}/en/politicas/`,
      },
    },
  };
}

export default async function PoliticasPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const isEn = lang === 'en';

  const texts = {
    title: isEn ? 'Policies and Conditions' : 'Políticas y Condiciones',
    back: isEn ? 'Back to home' : 'Volver al inicio',
    reservationTitle: isEn ? 'Reservation Policy' : 'Política de Reservación',
    reservationText: isEn 
      ? 'At Casa Caballo Soñador we strive to offer an exclusive, intimate, and highest quality experience for all our guests. By confirming your reservation, you secure a space in our sanctuary that has been carefully prepared for you.'
      : 'En Casa Caballo Soñador nos esforzamos por ofrecer una experiencia exclusiva, íntima y de la más alta calidad para todos nuestros huéspedes. Al confirmar tu reserva, aseguras un espacio en nuestro santuario que ha sido preparado cuidadosamente para ti.',
    cancellationTitle: isEn ? 'Strict Cancellation Policy: ' : 'Política de Cancelación Estricta: ',
    cancellationHighlight: isEn ? 'No Refunds' : 'No Hay Reembolsos',
    cancellationText1: isEn 
      ? 'Due to the boutique nature of our property and the exclusivity of our 6 suites, '
      : 'Debido a la naturaleza boutique de nuestra propiedad y a la exclusividad de nuestras 6 suites, ',
    cancellationStrong1: isEn ? 'all reservations are final and non-refundable' : 'todas las reservas son finales y no reembolsables',
    cancellationText2: isEn
      ? 'At the time of payment and reservation confirmation, the guest agrees that no partial or full refunds will be issued under any circumstances, including but not limited to:'
      : 'Al momento de realizar el pago y confirmar la reservación, el huésped acepta que no se emitirán reembolsos parciales ni totales bajo ninguna circunstancia, incluyendo pero no limitándose a:',
    bullets: [
      isEn ? 'Travel cancellations for personal or health reasons.' : 'Cancelaciones de viaje por motivos personales o de salud.',
      isEn ? 'Weather incidents, natural disasters, or adverse weather conditions.' : 'Incidencias meteorológicas, desastres naturales o condiciones climáticas adversas.',
      isEn ? 'Flight delays or cancellations.' : 'Retrasos o cancelaciones de vuelos.',
      isEn ? 'Early departures or late arrivals to the property.' : 'Salidas anticipadas o llegadas tardías a la propiedad.'
    ],
    modTitle: isEn ? 'Date Modification' : 'Modificación de Fechas',
    modText1: isEn
      ? 'We understand that unforeseen events may arise. If you need to modify the dates of your stay, we ask that you contact us at least '
      : 'Entendemos que pueden surgir imprevistos. Si necesitas modificar las fechas de tu estadía, te pedimos que nos contactes con al menos ',
    modStrong: isEn ? '30 days in advance' : '30 días de anticipación',
    modText2: isEn
      ? ' of your original arrival date. Modifications are subject to availability and current rates for the new dates. No changes will be allowed for reservations with less than 30 days notice.'
      : ' a tu fecha de llegada original. Las modificaciones están sujetas a disponibilidad y a las tarifas vigentes para las nuevas fechas. No se permitirán cambios en reservas con menos de 30 días de aviso.',
    stayTitle: isEn ? 'Stay Conditions' : 'Condiciones de Estancia',
    stayText: isEn
      ? 'Our House is designed to be a peaceful retreat. We ask our guests to maintain respectful behavior towards other visitors and the natural environment surrounding us. We reserve the right of admission and to terminate the stay of any guest who violates the sanctuary\'s coexistence rules, without the right to a refund.'
      : 'Nuestra Casa está diseñada para ser un retiro de paz. Solicitamos a nuestros huéspedes mantener un comportamiento respetuoso hacia los demás visitantes y el entorno natural que nos rodea. Nos reservamos el derecho de admisión y de terminar la estadía de cualquier huésped que incumpla con las normas de convivencia del santuario, sin derecho a reembolso.',
    contact: isEn
      ? 'For any inquiries regarding these policies, please contact us directly at '
      : 'Para cualquier consulta sobre estas políticas, por favor contáctanos directamente a '
  };

  return (
    <main className="min-h-screen bg-[#F9F7F4] text-[#23211F] pt-16 md:pt-32 pb-24 px-6 md:px-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <Link href={`/${lang}`} className="inline-flex items-center gap-2 text-[#23211F] hover:text-[#9B7E67] transition-colors uppercase tracking-widest text-sm md:text-base font-bold">
            <ArrowLeft size={16} /> {texts.back}
          </Link>
          
          <div className="flex items-center gap-4 text-[#23211F] font-bold tracking-widest text-sm md:text-base">
            <Link href="/es/politicas" className={`transition-colors ${!isEn ? 'text-[#9B7E67] underline underline-offset-4' : 'hover:text-[#9B7E67]'}`}>ES</Link>
            <span>/</span>
            <Link href="/en/politicas" className={`transition-colors ${isEn ? 'text-[#9B7E67] underline underline-offset-4' : 'hover:text-[#9B7E67]'}`}>EN</Link>
          </div>
        </div>
        
        <h1 className="font-serif text-5xl md:text-6xl mb-16 text-[#23211F] leading-tight">{texts.title}</h1>
        
        <div className="space-y-12 text-[#524D48] font-light leading-relaxed text-xl md:text-2xl">
          
          <section>
            <h2 className="font-serif text-3xl text-[#23211F] mb-6">{texts.reservationTitle}</h2>
            <p>{texts.reservationText}</p>
          </section>

          <section>
            <h2 className="font-serif text-3xl text-[#23211F] mb-6">{texts.cancellationTitle}<span className="text-[#9B7E67]">{texts.cancellationHighlight}</span></h2>
            <p className="mb-4">
              {texts.cancellationText1}<strong>{texts.cancellationStrong1}</strong>.
            </p>
            <p className="mb-4">
              {texts.cancellationText2}
            </p>
            <ul className="list-disc pl-6 space-y-2">
              {texts.bullets.map((bullet, idx) => (
                <li key={idx}>{bullet}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-3xl text-[#23211F] mb-6">{texts.modTitle}</h2>
            <p>
              {texts.modText1}<strong>{texts.modStrong}</strong>{texts.modText2}
            </p>
          </section>

          <section>
            <h2 className="font-serif text-3xl text-[#23211F] mb-6">{texts.stayTitle}</h2>
            <p>{texts.stayText}</p>
          </section>

          <hr className="border-[#E5E0D8] my-12" />

          <p className="text-base md:text-lg">
            {texts.contact}<strong>kelli9@telus.net</strong>.
          </p>
        </div>
      </div>
    </main>
  );
}

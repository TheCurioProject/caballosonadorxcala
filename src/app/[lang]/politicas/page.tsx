import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Políticas y Condiciones - Casa del Caballo Soñador',
  description: 'Políticas de reservación y cancelación de Casa del Caballo Soñador.',
};

export default function PoliticasPage() {
  return (
    <main className="min-h-screen bg-[#F9F7F4] text-[#23211F] pt-32 pb-24 px-6 md:px-16">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-[#9B7E67] hover:text-[#23211F] transition-colors mb-12 uppercase tracking-widest text-xs font-bold">
          <ArrowLeft size={16} /> Volver al inicio
        </Link>
        
        <h1 className="font-serif text-5xl md:text-6xl mb-16 text-[#23211F] leading-tight">Políticas y Condiciones</h1>
        
        <div className="space-y-12 text-[#524D48] font-light leading-relaxed text-lg">
          
          <section>
            <h2 className="font-serif text-3xl text-[#23211F] mb-6">Política de Reservación</h2>
            <p>
              En Casa del Caballo Soñador nos esforzamos por ofrecer una experiencia exclusiva, íntima y de la más alta calidad para todos nuestros huéspedes. Al confirmar tu reserva, aseguras un espacio en nuestro santuario que ha sido preparado cuidadosamente para ti.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-3xl text-[#23211F] mb-6">Política de Cancelación Estricta: <span className="text-[#9B7E67]">No Hay Reembolsos</span></h2>
            <p className="mb-4">
              Debido a la naturaleza boutique de nuestra propiedad y a la exclusividad de nuestras 6 suites, <strong>todas las reservas son finales y no reembolsables</strong>.
            </p>
            <p className="mb-4">
              Al momento de realizar el pago y confirmar la reservación, el huésped acepta que no se emitirán reembolsos parciales ni totales bajo ninguna circunstancia, incluyendo pero no limitándose a:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Cancelaciones de viaje por motivos personales o de salud.</li>
              <li>Incidencias meteorológicas, desastres naturales o condiciones climáticas adversas.</li>
              <li>Retrasos o cancelaciones de vuelos.</li>
              <li>Salidas anticipadas o llegadas tardías a la propiedad.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-3xl text-[#23211F] mb-6">Modificación de Fechas</h2>
            <p>
              Entendemos que pueden surgir imprevistos. Si necesitas modificar las fechas de tu estadía, te pedimos que nos contactes con al menos <strong>30 días de anticipación</strong> a tu fecha de llegada original. Las modificaciones están sujetas a disponibilidad y a las tarifas vigentes para las nuevas fechas. No se permitirán cambios en reservas con menos de 30 días de aviso.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-3xl text-[#23211F] mb-6">Condiciones de Estancia</h2>
            <p>
              Nuestra Casa está diseñada para ser un retiro de paz. Solicitamos a nuestros huéspedes mantener un comportamiento respetuoso hacia los demás visitantes y el entorno natural que nos rodea. Nos reservamos el derecho de admisión y de terminar la estadía de cualquier huésped que incumpla con las normas de convivencia del santuario, sin derecho a reembolso.
            </p>
          </section>

          <hr className="border-[#E5E0D8] my-12" />

          <p className="text-sm">
            Para cualquier consulta sobre estas políticas, por favor contáctanos directamente a <strong>kelli9@telus.net</strong>.
          </p>
        </div>
      </div>
    </main>
  );
}

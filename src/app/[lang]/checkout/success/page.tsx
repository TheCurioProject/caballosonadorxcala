import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { CheckCircle, ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

export const dynamic = 'force-dynamic';

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string; booking_id?: string };
}) {
  const { session_id, booking_id } = searchParams;
  let success = false;
  let guestName = '';

  if (session_id && booking_id) {
    try {
      // Very basic verification: in production you should use Webhooks for robust verification
      const session = await stripe.checkout.sessions.retrieve(session_id);
      
      if (session.payment_status === 'paid') {
        const booking = await prisma.booking.update({
          where: { id: parseInt(booking_id, 10) },
          data: { payment_status: 'CONFIRMED' }
        });
        
        success = true;
        guestName = booking.guestName;
      }
    } catch (error) {
      console.error('Error verifying session:', error);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9F7F4] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-xl bg-white p-12 rounded-[3rem] shadow-xl border border-black/5 flex flex-col items-center">
        {success ? (
          <>
            <div className="w-24 h-24 bg-[#9B7E67]/10 rounded-full flex items-center justify-center mb-8">
              <CheckCircle size={48} className="text-[#9B7E67]" />
            </div>
            <h1 className="font-serif text-4xl text-[#23211F] mb-4">¡Reserva Confirmada!</h1>
            <p className="text-[#524D48] text-lg font-light mb-8 leading-relaxed">
              Gracias, {guestName}. Tu pago se ha procesado con éxito y tu reserva en Casa Caballo Soñador está asegurada. Te hemos enviado un correo con todos los detalles.
            </p>
            <Link 
              href="/"
              className="bg-[#23211F] text-[#F9F7F4] hover:bg-[#9B7E67] font-bold text-xs uppercase tracking-widest py-4 px-8 rounded-full transition-all flex items-center gap-2"
            >
              Volver al Inicio <ArrowRight size={16} />
            </Link>
          </>
        ) : (
          <>
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-8">
              <X size={48} className="text-red-500" />
            </div>
            <h1 className="font-serif text-4xl text-[#23211F] mb-4">Error en la Reserva</h1>
            <p className="text-[#524D48] text-lg font-light mb-8 leading-relaxed">
              No pudimos verificar tu pago o la sesión ha expirado. Si crees que esto es un error, por favor contáctanos.
            </p>
            <Link 
              href="/"
              className="bg-gray-200 text-[#23211F] hover:bg-gray-300 font-bold text-xs uppercase tracking-widest py-4 px-8 rounded-full transition-all"
            >
              Volver al Inicio
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

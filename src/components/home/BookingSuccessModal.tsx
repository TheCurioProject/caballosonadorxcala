'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Calendar, Users, Moon, CreditCard, Mail, X } from 'lucide-react';

interface BookingSuccessModalProps {
  booking: {
    id: number;
    guestName: string;
    guestEmail: string;
    checkIn: Date;
    checkOut: Date;
    totalPrice: number;
    payment_status: string;
  };
  lang: string;
}

export function BookingSuccessModal({ booking, lang }: BookingSuccessModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error' | string>('idle');

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    // Remove query params from url without reloading page
    router.replace(`/${lang}`, { scroll: false });
  };

  if (!isOpen) return null;

  const nights = Math.round((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24));
  const formattedPrice = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(booking.totalPrice);

  const translations = {
    es: {
      successTitle: '¡Reserva Confirmada!',
      successMsg: 'Hemos procesado tu pago con éxito. Tu aventura en Casa Caballo Soñador está lista.',
      bookingDetails: 'Detalles de la Reserva',
      guest: 'Huésped',
      dates: 'Fechas',
      to: 'al',
      nights: 'Noches',
      totalPaid: 'Total Pagado',
      resendInvoice: 'Reenviar Factura / Recibo',
      resending: 'Enviando...',
      sent: '¡Enviado!',
      error: 'Error al enviar',
      close: 'Cerrar y Volver al Inicio'
    },
    en: {
      successTitle: 'Booking Confirmed!',
      successMsg: 'We have successfully processed your payment. Your adventure at Casa Caballo Soñador is ready.',
      bookingDetails: 'Booking Details',
      guest: 'Guest',
      dates: 'Dates',
      to: 'to',
      nights: 'Nights',
      totalPaid: 'Total Paid',
      resendInvoice: 'Resend Invoice',
      resending: 'Sending...',
      sent: 'Sent!',
      error: 'Error sending',
      close: 'Close and Return to Home'
    }
  };
  const t = translations[lang as 'es' | 'en'] || translations.es;

  const handleResendInvoice = async () => {
    setIsResending(true);
    setResendStatus('idle');
    try {
      const res = await fetch('/api/invoice/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, guestEmail: booking.guestEmail })
      });
      if (res.ok) {
        setResendStatus('success');
      } else {
        const data = await res.json().catch(() => ({}));
        setResendStatus(data.error || 'error');
      }
    } catch (e) {
      setResendStatus('error');
    }
    setIsResending(false);
    
    // Reset status after 5 seconds to let them read the error
    setTimeout(() => {
      setResendStatus('idle');
    }, 5000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#F9F7F4] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="relative bg-[#9B7E67] text-white p-6 text-center shrink-0">
          <button 
            onClick={close}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-[#F9F7F4]" />
          </div>
          <h2 className="text-2xl font-bold tracking-wide">{t.successTitle}</h2>
          <p className="mt-2 text-[#F9F7F4]/90 text-sm">
            {t.successMsg}
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto">
          <h3 className="text-lg font-semibold text-[#23211F] mb-4 border-b border-[#E5E0D8] pb-2">
            {t.bookingDetails}
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-[#9B7E67] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-[#666] uppercase tracking-wider">{t.guest}</p>
                <p className="text-[#23211F] font-medium">{booking.guestName}</p>
                <p className="text-[#666] text-sm">{booking.guestEmail}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-[#9B7E67] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-[#666] uppercase tracking-wider">{t.dates}</p>
                <p className="text-[#23211F] font-medium">
                  {new Date(booking.checkIn).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', { timeZone: 'UTC' })} {t.to} {new Date(booking.checkOut).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', { timeZone: 'UTC' })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Moon className="w-5 h-5 text-[#9B7E67] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-[#666] uppercase tracking-wider">{t.nights}</p>
                <p className="text-[#23211F] font-medium">{nights}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-[#9B7E67] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-[#666] uppercase tracking-wider">{t.totalPaid}</p>
                <p className="text-[#23211F] font-bold text-lg">{formattedPrice} MXN</p>
                <p className="text-[#666] text-xs">Aprobado via Stripe</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-white border-t border-[#E5E0D8] shrink-0 space-y-3">
          <button
            onClick={handleResendInvoice}
            disabled={isResending || resendStatus === 'success'}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-[#9B7E67] text-[#9B7E67] rounded-lg font-medium hover:bg-[#9B7E67]/5 transition-colors disabled:opacity-70"
          >
            <Mail className="w-4 h-4" />
            {isResending ? t.resending : resendStatus === 'success' ? t.sent : (resendStatus !== 'idle' && resendStatus !== 'error') ? resendStatus : (resendStatus === 'error' ? t.error : t.resendInvoice)}
          </button>
          
          <button
            onClick={close}
            className="w-full py-3 px-4 bg-[#23211F] text-white rounded-lg font-medium hover:bg-[#1a1917] transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}

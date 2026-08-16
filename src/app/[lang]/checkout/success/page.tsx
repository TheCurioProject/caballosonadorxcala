import prisma from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { CheckCircle, ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import React from 'react';
import { sendBookingConfirmation, sendInvoiceEmail, sendAdminBookingNotification, sendTourConfirmation, sendTourInvoiceEmail } from '@/lib/resend';
import { generateInvoicePDFBuffer, generateTourInvoicePDFBuffer } from '@/lib/pdf';
import { differenceInDays } from 'date-fns';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ session_id?: string; booking_id?: string; service_booking_id?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const resolvedParams = await params;
  
  const { session_id, booking_id, service_booking_id } = resolvedSearchParams;
  const { lang } = resolvedParams;
  
  const isEn = lang === 'en';

  let success = false;
  let guestName = '';

  if (session_id && (booking_id || service_booking_id)) {
    try {
      // Retrieve session to verify payment status — READ ONLY, no DB updates.
      // The webhook (POST /api/webhooks/stripe) is the single source of truth for confirming payments.
      const session = await stripe.checkout.sessions.retrieve(session_id);
      
      if (session.payment_status === 'paid') {
        if (booking_id) {
          // Verify that the session metadata matches the booking_id (prevent ID manipulation)
          if (session.metadata?.bookingId !== booking_id) {
            console.warn('[Success Page] Session metadata bookingId mismatch:', session.metadata?.bookingId, '!=', booking_id);
          } else {
            let booking = await prisma.booking.findUnique({
              where: { id: parseInt(booking_id, 10) },
              include: { property: true, addons: true }
            });

            if (booking && booking.payment_status === 'PENDING') {
              console.log('[Success Page Fallback] Confirming booking', booking_id);
              const amountTotal = session.amount_total ? session.amount_total / 100 : undefined;
              booking = await prisma.booking.update({
                where: { id: parseInt(booking_id, 10) },
                data: { 
                  payment_status: 'CONFIRMED',
                  ...(amountTotal !== undefined ? { totalPrice: amountTotal } : {})
                },
                include: { property: true, addons: true },
              });

              // Send Emails Fallback
              try {
                const currency = (session.currency || 'mxn').toUpperCase();
                const nights = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));

                await sendBookingConfirmation({
                  guestName: booking.guestName,
                  guestEmail: booking.guestEmail,
                  checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
                  checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
                  totalPrice: booking.totalPrice,
                  currency,
                  bookingId: booking.id,
                  nights,
                });

                const rawAdminEmails = booking.property?.adminEmails || 'kelli9@telus.net';
                const adminEmailArray = rawAdminEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e);

                let pdfBuffer: Buffer | undefined = undefined;
                try {
                  const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_official.png');
                  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
                  pdfBuffer = await generateInvoicePDFBuffer({
                    bookingId: booking.id,
                    guestName: booking.guestName,
                    roomName: booking.property?.name || 'Casa Caballo Soñador',
                    checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
                    checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
                    totalPrice: booking.totalPrice,
                    depositPaid: booking.depositPaid || 0,
                    depositCurrency: booking.depositCurrency || 'MXN',
                    date: new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
                    logoBase64,
                    addons: booking.addons
                  });
                } catch (e) { console.error('PDF error in fallback', e); }

                const emailData = {
                  guestName: booking.guestName,
                  guestEmail: booking.guestEmail,
                  checkIn: new Date(booking.checkIn).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
                  checkOut: new Date(booking.checkOut).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
                  totalPrice: booking.totalPrice,
                  currency,
                  bookingId: booking.id,
                  nights,
                };

                if (adminEmailArray.length > 0) await sendAdminBookingNotification(adminEmailArray, emailData, pdfBuffer);
                await sendInvoiceEmail(emailData, pdfBuffer);
              } catch (e) {
                console.error('[Success Page Fallback] Email error:', e);
              }
            }

            if (booking && booking.payment_status === 'CONFIRMED') {
              success = true;
              guestName = booking.guestName;
            }
          }
        } else if (service_booking_id) {
          // Verify that the session metadata matches the serviceBookingId
          if (session.metadata?.serviceBookingId !== service_booking_id) {
            console.warn('[Success Page] Session metadata serviceBookingId mismatch:', session.metadata?.serviceBookingId, '!=', service_booking_id);
          } else {
            let serviceBooking = await prisma.serviceBooking.findUnique({
              where: { id: parseInt(service_booking_id, 10) }
            });

            if (serviceBooking && serviceBooking.paymentStatus === 'PENDING') {
              console.log('[Success Page Fallback] Confirming tour booking', service_booking_id);
              serviceBooking = await prisma.serviceBooking.update({
                where: { id: parseInt(service_booking_id, 10) },
                data: { paymentStatus: 'CONFIRMED' }
              });

              // Send Emails Fallback
              try {
                const currency = (session.currency || 'mxn').toUpperCase();
                let tourDetails = { destinations: [] as any[] };
                try { tourDetails = JSON.parse(serviceBooking.serviceDetails); } catch (e) {}
                const destinationNames = tourDetails.destinations?.map((d: any) => d.name).join(', ') || 'Tour';

                const property = await prisma.property.findFirst();
                const rawAdminEmails = property?.adminEmails || 'kelli9@telus.net';
                const adminEmailArray = rawAdminEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e);

                await sendTourConfirmation({
                  guestName: serviceBooking.guestName,
                  guestEmail: serviceBooking.guestEmail,
                  tourDestination: destinationNames,
                  date: new Date(serviceBooking.startDate).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
                  pax: serviceBooking.pax || 1,
                  totalPrice: serviceBooking.totalPrice,
                  currency,
                  bookingId: serviceBooking.id
                });

                let pdfBuffer: Buffer | undefined = undefined;
                try {
                  const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_official.png');
                  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
                  pdfBuffer = await generateTourInvoicePDFBuffer({
                    bookingId: serviceBooking.id,
                    guestName: serviceBooking.guestName,
                    tourDestination: destinationNames,
                    date: new Date(serviceBooking.startDate).toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
                    pax: serviceBooking.pax || 1,
                    totalPrice: serviceBooking.totalPrice,
                    currency,
                    issueDate: new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' }),
                    logoBase64
                  });
                } catch (e) { console.error('Tour PDF error in fallback', e); }

                const emailData = {
                  guestName: serviceBooking.guestName,
                  guestEmail: serviceBooking.guestEmail,
                  tourDestination: destinationNames,
                  date: new Date(serviceBooking.startDate).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
                  pax: serviceBooking.pax || 1,
                  totalPrice: serviceBooking.totalPrice,
                  currency,
                  bookingId: serviceBooking.id
                };

                if (adminEmailArray.length > 0) await sendAdminBookingNotification(adminEmailArray, emailData, pdfBuffer);
                await sendTourInvoiceEmail(emailData, pdfBuffer);
              } catch (e) {
                console.error('[Success Page Fallback] Tour Email error:', e);
              }
            }

            if (serviceBooking && serviceBooking.paymentStatus === 'CONFIRMED') {
              success = true;
              guestName = serviceBooking.guestName;
            }
          }
        }
      }
    } catch (error) {
      console.error('[Success Page] Error verifying session:', error);
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
            <h1 className="font-serif text-4xl text-[#23211F] mb-4">
              {isEn ? "Booking Confirmed!" : "¡Reserva Confirmada!"}
            </h1>
            <p className="text-[#524D48] text-xl md:text-2xl font-light mb-8 leading-relaxed">
              {isEn 
                ? `Thank you, ${guestName}. Your payment has been successfully processed and your reservation at Casa Caballo Soñador is secured. We have sent you an email with all the details.`
                : `Gracias, ${guestName}. Tu pago se ha procesado con éxito y tu reserva en Casa Caballo Soñador está asegurada. Te hemos enviado un correo con todos los detalles.`
              }
            </p>
            <Link 
              href={`/${lang}`}
              className="bg-[#23211F] text-[#F9F7F4] hover:bg-[#9B7E67] font-bold text-sm md:text-base uppercase tracking-widest py-4 px-8 rounded-full transition-all flex items-center gap-2"
            >
              {isEn ? "Return to Home" : "Volver al Inicio"} <ArrowRight size={16} />
            </Link>
          </>
        ) : (
          <>
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-8">
              <X size={48} className="text-red-500" />
            </div>
            <h1 className="font-serif text-4xl text-[#23211F] mb-4">
              {isEn ? "Booking Error" : "Error en la Reserva"}
            </h1>
            <p className="text-[#524D48] text-xl md:text-2xl font-light mb-8 leading-relaxed">
              {isEn 
                ? "We couldn't verify your payment or the session has expired. If you believe this is an error, please contact us."
                : "No pudimos verificar tu pago o la sesión ha expirado. Si crees que esto es un error, por favor contáctanos."
              }
            </p>
            <Link 
              href={`/${lang}`}
              className="bg-gray-200 text-[#23211F] hover:bg-gray-300 font-bold text-sm md:text-base uppercase tracking-widest py-4 px-8 rounded-full transition-all"
            >
              {isEn ? "Return to Home" : "Volver al Inicio"}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

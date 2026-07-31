export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendTourInvoiceEmail } from '@/lib/resend';
import { renderToBuffer } from '@react-pdf/renderer';
import { TourInvoicePDF } from '@/components/pdf/TourInvoicePDF';
import React from 'react';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return NextResponse.json({ error: 'Falta bookingId' }, { status: 400 });
    }

    const booking = await prisma.serviceBooking.findUnique({
      where: { id: parseInt(bookingId) }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    if (booking.serviceType !== 'TOUR') {
      return NextResponse.json({ error: 'Tipo de servicio no válido' }, { status: 400 });
    }

    let tourDetails = { destinations: [] as any[] };
    try {
      tourDetails = JSON.parse(booking.serviceDetails);
    } catch (e) {
      console.warn('Failed to parse serviceDetails', e);
    }
    const destinationNames = tourDetails.destinations?.map((d: any) => d.name).join(', ') || 'Tour';

    const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_official.png');
    const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';

    const pdfBuffer = await renderToBuffer(
      <TourInvoicePDF 
        bookingId={booking.id}
        guestName={booking.guestName}
        tourDestination={destinationNames}
        date={booking.startDate.toLocaleDateString('es-MX')}
        pax={booking.pax || 1}
        totalPrice={booking.totalPrice}
        issueDate={new Date().toLocaleDateString('es-MX')}
        logoBase64={logoBase64}
      /> as any
    );

    const emailData = {
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      tourDestination: destinationNames,
      date: booking.startDate.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
      pax: booking.pax || 1,
      totalPrice: booking.totalPrice,
      currency: 'MXN', // Or derived from somewhere else
      bookingId: booking.id
    };

    const emailResult = await sendTourInvoiceEmail(emailData, Buffer.from(pdfBuffer));

    const property = await prisma.property.findFirst();
    const adminEmails = property?.adminEmails ? property.adminEmails.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
    if (adminEmails.length > 0) {
      const { sendAdminBookingNotification } = await import('@/lib/resend');
      await sendAdminBookingNotification(adminEmails, emailData, Buffer.from(pdfBuffer));
    }

    if (!emailResult.success) {
      console.error('[SendTourInvoice] Error sending email:', emailResult.error);
      return NextResponse.json({ error: 'No se pudo enviar el correo' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SendTourInvoice API] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

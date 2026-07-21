import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/components/pdf/InvoicePDF';
import { sendInvoiceEmail } from '@/lib/resend';
import React from 'react';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { bookingId, sendToClient, clientEmail } = await request.json();

    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'Missing bookingId' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { property: true }
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const checkIn = booking.checkIn.toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' });
    const checkOut = booking.checkOut.toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' });
    const date = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' });

    // Read Logo as base64
    const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_secondary_dark.png');
    let logoBase64 = '';
    if (fs.existsSync(logoPath)) {
      logoBase64 = fs.readFileSync(logoPath).toString('base64');
    } else {
      const webpPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_secondary_dark.webp');
      if (fs.existsSync(webpPath)) {
        logoBase64 = fs.readFileSync(webpPath).toString('base64');
      }
    }

    // Generate PDF Buffer
    const pdfBuffer = await renderToBuffer(
      <InvoicePDF 
        bookingId={booking.id}
        guestName={booking.guestName}
        roomName={booking.property.name}
        checkIn={checkIn}
        checkOut={checkOut}
        totalPrice={booking.totalPrice}
        depositPaid={booking.depositPaid || 0}
        depositCurrency={booking.depositCurrency || 'MXN'}
        date={date}
        logoBase64={logoBase64}
      /> as any
    );

    const pdfBase64 = (pdfBuffer as Buffer).toString('base64');

    // Prepare data for Resend
    const data = {
      guestName: booking.guestName,
      guestEmail: 'kelli9@telus.net', // Always send to Kelli first
      checkIn: checkIn,
      checkOut: checkOut,
      totalPrice: booking.totalPrice,
      currency: 'MXN', 
      bookingId: booking.id,
      nights: Math.ceil((booking.checkOut.getTime() - booking.checkIn.getTime()) / (1000 * 3600 * 24))
    };

    // Send email to admin (Kelli)
    const adminResult = await sendInvoiceEmail(data, pdfBuffer as Buffer);
    if (!adminResult.success) {
      console.error('Failed to send invoice to admin:', adminResult.error);
    }

    // Update booking guest email if clientEmail is provided and changed
    if (clientEmail && clientEmail !== booking.guestEmail) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { guestEmail: clientEmail }
      });
    }

    // Send email to client if requested
    let clientResult: { success: boolean; error?: any } = { success: false, error: 'Not requested' };
    if (sendToClient && clientEmail) {
      const clientData = { ...data, guestEmail: clientEmail };
      clientResult = await sendInvoiceEmail(clientData, pdfBuffer as Buffer);
    }

    return NextResponse.json({ 
      success: sendToClient ? clientResult.success : true, 
      pdfBase64, 
      adminEmailSent: adminResult.success,
      clientEmailSent: clientResult.success,
      error: clientResult.error ? String(clientResult.error) : undefined
    });

  } catch (error) {
    console.error('Error in /api/admin/send-invoice-flow:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

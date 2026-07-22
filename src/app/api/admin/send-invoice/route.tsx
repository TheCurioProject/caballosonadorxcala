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
    const { bookingId, email } = await request.json();

    if (!bookingId || !email) {
      return NextResponse.json({ success: false, error: 'Missing bookingId or email' }, { status: 400 });
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
    const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_primary_white.png');
    const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';

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

    // Prepare data for Resend
    const data = {
      guestName: booking.guestName,
      guestEmail: email, // Use the one provided in request, in case they typed a new one
      checkIn: checkIn,
      checkOut: checkOut,
      totalPrice: booking.totalPrice,
      currency: 'MXN', // Default or from booking if you add it
      bookingId: booking.id,
      nights: Math.ceil((booking.checkOut.getTime() - booking.checkIn.getTime()) / (1000 * 3600 * 24))
    };

    // Send email via resend.ts
    const result = await sendInvoiceEmail(data, pdfBuffer as Buffer);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      console.error('Error in sendInvoiceEmail:', result.error);
      return NextResponse.json({ success: false, error: 'Error sending email' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in /api/admin/send-invoice:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

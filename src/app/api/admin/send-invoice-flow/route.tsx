import { getSession } from '@/lib/auth';
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
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookingId, sendToClient, clientEmail, invoiceLanguage } = await request.json();

    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'Missing bookingId' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { property: true, addons: true }
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const checkIn = booking.checkIn.toLocaleDateString('es-MX', { timeZone: 'UTC' });
    const checkOut = booking.checkOut.toLocaleDateString('es-MX', { timeZone: 'UTC' });
    const date = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mazatlan' });

    // Read Logo as base64
    const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_official.png');
    let logoBase64 = '';
    if (fs.existsSync(logoPath)) {
      logoBase64 = fs.readFileSync(logoPath).toString('base64');
    } else {
      const fallbackPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_secondary_dark.png');
      if (fs.existsSync(fallbackPath)) {
        logoBase64 = fs.readFileSync(fallbackPath).toString('base64');
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
        addons={booking.addons}
        language={invoiceLanguage || booking.invoiceLanguage || 'en'}
      /> as any
    );

    const pdfBase64 = (pdfBuffer as Buffer).toString('base64');

    const rawAdminEmails = booking.property?.adminEmails || 'kelli9@telus.net';
    const adminEmailArray = rawAdminEmails.split(',').map(e => e.trim()).filter(e => e);

    // Prepare data for Resend
    const data = {
      guestName: booking.guestName,
      guestEmail: booking.guestEmail, // This is just for the PDF/logs
      checkIn: checkIn,
      checkOut: checkOut,
      totalPrice: booking.totalPrice,
      currency: 'MXN', 
      bookingId: booking.id,
      nights: Math.ceil((booking.checkOut.getTime() - booking.checkIn.getTime()) / (1000 * 3600 * 24)),
      language: invoiceLanguage || booking.invoiceLanguage || 'en'
    };

    // Send email to admin(s)
    const adminData = { ...data, toEmails: adminEmailArray.length > 0 ? adminEmailArray : ['kelli9@telus.net'] };
    const adminResult = await sendInvoiceEmail(adminData, pdfBuffer as Buffer);
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

    let errorMessage = clientResult.error;
    if (clientResult.error && typeof clientResult.error === 'object') {
      errorMessage = clientResult.error.message || JSON.stringify(clientResult.error);
    }

    return NextResponse.json({ 
      success: sendToClient ? clientResult.success : true, 
      pdfBase64, 
      adminEmailSent: adminResult.success,
      clientEmailSent: clientResult.success,
      error: errorMessage ? String(errorMessage) : undefined
    });

  } catch (error) {
    console.error('Error in /api/admin/send-invoice-flow:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

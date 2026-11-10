import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/components/pdf/InvoicePDF';
import React from 'react';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    const bookingId = parseInt(resolvedParams.bookingId, 10);
    
    if (isNaN(bookingId)) {
      return new NextResponse('Invalid Booking ID', { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { property: true, addons: true }
    });

    if (!booking) {
      return new NextResponse('Booking not found', { status: 404 });
    }

    const logoPath = path.join(process.cwd(), 'public', 'imagenes', '01_logo', 'logo_official.png');
    const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';

    const pdfBuffer = await renderToBuffer(
      <InvoicePDF 
        bookingId={booking.id}
        guestName={booking.guestName}
        roomName={booking.property.name}
        checkIn={booking.checkIn.toLocaleDateString('es-MX', { timeZone: 'UTC' })}
        checkOut={booking.checkOut.toLocaleDateString('es-MX', { timeZone: 'UTC' })}
        totalPrice={booking.totalPrice}
        depositPaid={booking.depositPaid || 0}
        depositCurrency={booking.depositCurrency || 'MXN'}
        date={new Date().toLocaleDateString()}
        logoBase64={logoBase64}
        addons={booking.addons}
        language={(booking.invoiceLanguage as 'en' | 'es') || 'en'}
      /> as any
    );

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${booking.id}.pdf"`
      }
    });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

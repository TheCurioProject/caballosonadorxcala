import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { renderToBuffer } from '@react-pdf/renderer';
import { TourInvoicePDF } from '@/components/pdf/TourInvoicePDF';
import React from 'react';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serviceBookingId: string }> }
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const resolvedParams = await params;
    const serviceBookingId = parseInt(resolvedParams.serviceBookingId, 10);
    
    if (isNaN(serviceBookingId)) {
      return new NextResponse('Invalid Booking ID', { status: 400 });
    }

    const booking = await prisma.serviceBooking.findUnique({
      where: { id: serviceBookingId }
    });

    if (!booking) {
      return new NextResponse('Booking not found', { status: 404 });
    }
    
    if (booking.serviceType !== 'TOUR') {
      return new NextResponse('Invalid service type', { status: 400 });
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
        date={booking.startDate.toLocaleDateString('es-MX', { timeZone: 'UTC' })}
        pax={booking.pax || 1}
        totalPrice={booking.totalPrice}
        issueDate={new Date().toLocaleDateString()}
        logoBase64={logoBase64}
        language={(booking.invoiceLanguage as 'en' | 'es') || 'en'}
      /> as any
    );

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="tour-invoice-${booking.id}.pdf"`
      }
    });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

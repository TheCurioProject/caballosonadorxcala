import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDF } from '@/components/pdf/InvoicePDF';
import React from 'react';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const resolvedParams = await params;
    const bookingId = parseInt(resolvedParams.bookingId, 10);
    
    if (isNaN(bookingId)) {
      return new NextResponse('Invalid Booking ID', { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { property: true }
    });

    if (!booking) {
      return new NextResponse('Booking not found', { status: 404 });
    }

    const pdfBuffer = await renderToBuffer(
      <InvoicePDF 
        bookingId={booking.id}
        guestName={booking.guestName}
        roomName={booking.property.name}
        checkIn={booking.checkIn.toLocaleDateString()}
        checkOut={booking.checkOut.toLocaleDateString()}
        totalPrice={booking.totalPrice}
        date={new Date().toLocaleDateString()}
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

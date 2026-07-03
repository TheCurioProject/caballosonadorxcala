import { NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import prisma from '@/lib/prisma';
import { InvoiceDocument } from '@/components/pdf/InvoiceDocument';
import React from 'react';

// Forzamos que se ejecute en el runtime de Node, ya que @react-pdf depende de Node APIs
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bookingIdStr = searchParams.get('bookingId');

  if (!bookingIdStr) {
    return NextResponse.json({ error: 'Falta bookingId' }, { status: 400 });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingIdStr, 10) },
      include: { property: true }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    const data = {
      bookingId: booking.id,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      roomName: booking.property.name,
      checkIn: booking.checkIn.toLocaleDateString(),
      checkOut: booking.checkOut.toLocaleDateString(),
      totalPrice: booking.totalPrice,
      date: new Date().toLocaleDateString(),
    };

    // Renderizamos el componente de React PDF a un Node.js Stream
    // @ts-ignore
    const stream = await renderToStream(React.createElement(InvoiceDocument, { data }));

    // Convertimos el Readable Stream de Node a Web ReadableStream para NextResponse
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      }
    });

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Factura-${booking.id}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generando PDF:', error);
    return NextResponse.json({ error: 'Error interno generando PDF' }, { status: 500 });
  }
}

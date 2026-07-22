import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import ical from 'ical-generator';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const resolvedParams = await params;
    const propertyId = parseInt(resolvedParams.propertyId, 10);
    
    if (isNaN(propertyId)) {
      return new NextResponse('Invalid Room ID', { status: 400 });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        bookings: true
      }
    });

    if (!property) {
      return new NextResponse('Room not found', { status: 404 });
    }

    const calendar = ical({
      name: `Calendario - ${property.name}`,
      timezone: 'America/Mexico_City' // Adaptar según ubicación
    });

    for (const booking of property.bookings) {
      calendar.createEvent({
        start: booking.checkIn,
        end: booking.checkOut,
        summary: `Reserva - ${property.name}`,
        description: `Huésped: ${booking.guestName}`,
        id: booking.externalId || `internal-${booking.id}`
      });
    }

    return new NextResponse(calendar.toString(), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="room-${propertyId}.ics"`
      }
    });

  } catch (error) {
    console.error('iCal Export Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

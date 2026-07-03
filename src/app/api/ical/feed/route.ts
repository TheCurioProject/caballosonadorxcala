import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import ical from 'ical-generator';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyIdStr = searchParams.get('propertyId');

  if (!propertyIdStr) {
    return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
  }

  const propertyId = parseInt(propertyIdStr, 10);
  if (isNaN(propertyId)) {
    return NextResponse.json({ error: 'Invalid propertyId' }, { status: 400 });
  }

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        propertyId,
      },
    });

    const calendar = ical({
      name: `Calendario de Reservas - ${property.name}`,
      timezone: 'America/Mexico_City',
    });

    for (const booking of bookings) {
      calendar.createEvent({
        start: booking.checkIn,
        end: booking.checkOut,
        summary: `Reserva - ${property.name}`,
        description: `Origen: ${booking.origin}`,
        // @ts-ignore
        uid: booking.externalId || `internal-${booking.id}`,
      });
    }

    return new NextResponse(calendar.toString(), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="room-${propertyId}.ics"`,
      },
    });
  } catch (error) {
    console.error('Error generating iCal feed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

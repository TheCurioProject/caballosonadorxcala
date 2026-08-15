export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // VULN-07 FIX: Require admin authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    const query = propertyId ? { propertyId: parseInt(propertyId) } : {};

    // Obtener reservas futuras
    const bookings = await prisma.booking.findMany({
      where: {
        ...query,
        checkOut: { gte: new Date() }, // Solo traer reservas actuales/futuras
      },
      select: {
        id: true,
        propertyId: true,
        checkIn: true,
        checkOut: true,
      },
    });

    return NextResponse.json({ success: true, bookings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // VULN-07 FIX: Require admin authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    
    // Validar superposición de fechas antes de crear
    const conflictingBookings = await prisma.booking.findMany({
      where: {
        propertyId: data.propertyId,
          checkIn: { lte: new Date(data.checkOut) },
          checkOut: { gte: new Date(data.checkIn) }
      }
    });

    if (conflictingBookings.length > 0) {
      return NextResponse.json({ success: false, error: 'Fechas no disponibles.' }, { status: 400 });
    }

    const booking = await prisma.booking.create({
      data: {
        propertyId: data.propertyId,
        checkIn: new Date(data.checkIn),
        checkOut: new Date(data.checkOut),
        guestName: data.guestName,
        guestEmail: data.guestEmail,
        guestPhone: data.guestPhone || '',
        totalPrice: data.totalPrice,
        origin: 'WEBSITE',
        payment_status: 'PENDING',
      }
    });

    return NextResponse.json({ success: true, booking });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

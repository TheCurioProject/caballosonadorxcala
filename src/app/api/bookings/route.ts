import { assertAvailability } from '@/lib/reservations';
import { validGuest, parseCalendarDate } from '@/lib/bookingPolicy';
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

    if (propertyId && (!Number.isSafeInteger(Number(propertyId)) || Number(propertyId) < 1)) return NextResponse.json({ error: 'Invalid propertyId' }, { status: 400 });
    const query = propertyId ? { propertyId: Number(propertyId) } : {};

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
    if (error?.message === 'DATES_UNAVAILABLE') return NextResponse.json({ error: 'Fechas no disponibles' }, { status: 409 });
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
    
    const checkIn = parseCalendarDate(data.checkIn);
    const checkOut = parseCalendarDate(data.checkOut);
    if (!checkIn || !checkOut || checkOut <= checkIn || !Number.isSafeInteger(data.propertyId) || data.propertyId < 1 ||
        !validGuest(data.guestName, data.guestEmail, data.guestPhone) || typeof data.totalPrice !== 'number' || !Number.isFinite(data.totalPrice) || data.totalPrice < 0) {
      return NextResponse.json({ error: 'Invalid booking data' }, { status: 400 });
    }
    const booking = await prisma.$transaction(async tx => {
      await assertAvailability(tx, data.propertyId, checkIn, checkOut);
      return tx.booking.create({ data: {
        propertyId: data.propertyId, checkIn, checkOut, guestName: data.guestName,
        guestEmail: data.guestEmail, guestPhone: data.guestPhone || '',
        totalPrice: data.totalPrice, origin: 'WEBSITE', payment_status: 'PENDING',
      } });
    });

    return NextResponse.json({ success: true, booking });
  } catch (error: any) {
    if (error?.message === 'DATES_UNAVAILABLE') return NextResponse.json({ error: 'Fechas no disponibles' }, { status: 409 });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

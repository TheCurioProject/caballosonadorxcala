export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const property = await prisma.property.findFirst();
    
    if (!property) {
      return NextResponse.json({ disabledDates: [] });
    }

    // Get all manual blocks for this property that are in the future (or current month)
    const blocks = await prisma.blockedDate.findMany({
      where: {
        propertyId: property.id,
        endDate: { gte: new Date() }
      }
    });

    // Get all confirmed bookings
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId: property.id,
        payment_status: 'CONFIRMED',
        checkOut: { gte: new Date() }
      }
    });

    // We will send back a list of blocked ranges
    const disabledRanges = [];

    for (const b of blocks) {
      disabledRanges.push({ from: b.startDate, to: b.endDate });
    }

    for (const b of bookings) {
      disabledRanges.push({ from: b.checkIn, to: b.checkOut });
    }

    return NextResponse.json({ disabledRanges });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const property = await prisma.property.findFirst();
    
    if (!property) {
      return NextResponse.json({ disabledDates: [] });
    }

    // Clean up expired pending bookings (older than 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.booking.deleteMany({
      where: {
        payment_status: 'PENDING',
        createdAt: {
          lt: fifteenMinutesAgo
        }
      }
    });

    // Get all manual blocks for this property that are in the future (or current month)
    const blocks = await prisma.blockedDate.findMany({
      where: {
        propertyId: property.id,
        endDate: { gte: new Date() }
      }
    });

    // Get all confirmed bookings AND valid pending bookings
    const bookings = await prisma.booking.findMany({
      where: {
        propertyId: property.id,
        payment_status: {
          in: ['CONFIRMED', 'PENDING']
        },
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

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

    // We will send back a list of blocked ranges split by type
    const disabledRanges = [];
    const bookedRanges = [];
    const bufferRanges = [];
    const blockedRanges = [];

    for (const b of blocks) {
      disabledRanges.push({ from: b.startDate, to: b.endDate });
      blockedRanges.push({ from: b.startDate, to: b.endDate });
    }

    for (const b of bookings) {
      disabledRanges.push({ from: b.checkIn, to: b.checkOut });
      
      // The booked nights
      const checkoutMinusOne = new Date(b.checkOut);
      checkoutMinusOne.setDate(checkoutMinusOne.getDate() - 1);
      if (b.checkIn <= checkoutMinusOne) {
        bookedRanges.push({ from: b.checkIn, to: checkoutMinusOne });
      }
      
      // The buffer day (checkout day itself)
      bufferRanges.push({ from: b.checkOut, to: b.checkOut });
    }

    return NextResponse.json({ 
      disabledRanges,
      bookedRanges,
      bufferRanges,
      blockedRanges,
      propertySettings: {
        checkInTime: "15:00",
        checkOutTime: "12:00"
      }
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}

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

    // Get all TOUR service bookings
    const tourBookings = await prisma.serviceBooking.findMany({
      where: {
        serviceType: 'TOUR',
        paymentStatus: {
          in: ['CONFIRMED', 'PENDING']
        },
        endDate: { gte: new Date() }
      }
    });

    // We will send back a list of blocked ranges split by type
    const disabledRanges = [];
    const bookedRanges = [];
    const bufferRanges = [];
    const blockedRanges = [];
    const tourBookedDates = []; // List of specific dates that have a tour booked

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

    // Populate tour booked dates
    for (const t of tourBookings) {
      let d = new Date(t.startDate);
      d.setHours(0,0,0,0);
      const end = new Date(t.endDate);
      end.setHours(0,0,0,0);
      while (d <= end) {
        tourBookedDates.push(d.toISOString());
        d = new Date(d.setDate(d.getDate() + 1));
      }
    }

    return NextResponse.json({ 
      disabledRanges,
      bookedRanges,
      bufferRanges,
      blockedRanges,
      tourBookedDates,
      propertySettings: {
        checkInTime: "15:00",
        checkOutTime: "12:00",
        basePrice: property.basePrice
      }
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}

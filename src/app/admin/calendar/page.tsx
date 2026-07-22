import prisma from '@/lib/prisma';
import React from 'react';
import AdminCalendarClient from './AdminCalendarClient';

export const dynamic = 'force-dynamic';

export default async function AdminCalendarPage() {
  let property: any = null;
  let holidays: any[] = [];
  let tourBookings: any[] = [];

  try {
    const [fetchedProperty, fetchedHolidays, fetchedTourBookings] = await Promise.all([
      prisma.property.findFirst({
        include: {
          bookings: {
            where: { checkOut: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1) } },
            orderBy: { checkIn: 'asc' }
          },
          blockedDates: {
            where: { endDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1) } },
            orderBy: { startDate: 'asc' }
          },
          pricingRules: {
            where: { date: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1) } }
          }
        }
      }),
      // @ts-ignore
      prisma.holidayRule ? prisma.holidayRule.findMany({
        where: { endDate: { gte: new Date() } }
      }) : Promise.resolve([]),
      prisma.serviceBooking.findMany({
        where: {
          serviceType: 'TOUR',
          paymentStatus: { in: ['CONFIRMED', 'PENDING'] },
          endDate: { gte: new Date() }
        }
      })
    ]);
    property = fetchedProperty;
    holidays = fetchedHolidays;
    tourBookings = fetchedTourBookings;
  } catch (error) {
    console.error('Failed to fetch calendar data:', error);
  }

  if (!property) {
    return <div className="p-8 text-center text-gray-500">Property configuration not found</div>;
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-serif text-[#23211F] mb-4">Calendar & Pricing</h1>
        <p className="text-gray-500 font-light text-lg">
          Manage bookings, block dates, and adjust daily rates for your property.
        </p>
      </div>

      <AdminCalendarClient 
        roomId={property.id}
        basePrice={property.basePrice}
        bookings={property.bookings}
        tourBookings={tourBookings}
        blocks={property.blockedDates}
        dailyRates={property.pricingRules}
        holidays={holidays}
      />
    </div>
  );
}

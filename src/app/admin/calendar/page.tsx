import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import React from 'react';
import AdminCalendarClient from './AdminCalendarClient';

export const dynamic = 'force-dynamic';

export default async function AdminCalendarPage() {
  let property = await prisma.property.findFirst({
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
  });

  if (!property) {
    property = await prisma.property.create({
      data: {
        name: 'Casa del Caballo Soñador',
        baseCapacity: 12,
        basePrice: 1500,
      },
      include: {
        bookings: true,
        blockedDates: true,
        pricingRules: true
      }
    });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="mb-8">
        <h2 className="text-4xl font-serif text-[#23211F]">Master Calendar</h2>
        <p className="text-gray-500 font-light mt-2">
          Visual management of availability and daily rates. Click on a day to interact.
        </p>
      </div>

        <div className="w-full">
          <AdminCalendarClient 
            roomId={property.id}
            basePrice={property.basePrice}
            bookings={property.bookings}
            blocks={property.blockedDates}
            holidays={[]}
            dailyRates={property.pricingRules as any}
          />
        </div>
    </div>
  );
}

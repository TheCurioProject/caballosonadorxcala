import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import React from 'react';
import AdminCalendarClient from './AdminCalendarClient';

export const dynamic = 'force-dynamic';

export default async function AdminCalendarPage() {
  let property: any = null;
  try {
    const fetchProp = prisma.property.findFirst({
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
    const timeout = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Prisma timeout')), 3000));
    property = await Promise.race([fetchProp, timeout]);
  } catch (error) {
    console.warn("Failed to fetch property from Prisma in calendar:", error);
  }

  if (!property) {
    property = {
      id: 1,
      name: 'Casa Caballo Soñador',
      baseCapacity: 12,
      basePrice: 1500,
      bookings: [],
      blockedDates: [],
      pricingRules: []
    };
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="mb-4 sm:mb-8">
        <h2 className="text-2xl sm:text-4xl font-serif text-[#23211F]">Master Calendar</h2>
        <p className="text-gray-500 font-light mt-1 sm:mt-2 text-sm sm:text-base">
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

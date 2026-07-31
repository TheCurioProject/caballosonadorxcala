import prisma from '@/lib/prisma';
import React from 'react';
import IcalWorkspace from './IcalWorkspace';

export const dynamic = 'force-dynamic';

export default async function AdminICalPage() {
  let property: any = null;
  try {
    const fetchProp = prisma.property.findFirst({
      include: { icalSources: true }
    });
    const timeout = new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Prisma timeout')), 12000));
    property = await Promise.race([fetchProp, timeout]);
  } catch (error) {
    console.warn("Failed to fetch ical property from Prisma:", error);
  }

  if (!property) {
    property = {
      id: 1,
      name: 'Casa Caballo Soñador',
      baseCapacity: 12,
      basePrice: 1500,
      icalSources: []
    };
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl sm:text-4xl font-serif text-[#23211F]">iCal Integrations</h2>
        <p className="text-gray-500 font-light mt-1 sm:mt-2 text-sm sm:text-base">
          Sync your property availability with external channels like Airbnb and Booking.com.
        </p>
      </div>

      <IcalWorkspace 
        roomId={property.id}
        initialFeeds={property.icalSources.map((f: any) => ({ 
          id: f.id, 
          name: f.name, 
          url: f.url,
          syncStatus: f.syncStatus,
          lastSync: f.lastSync,
          syncError: f.syncError
        }))}
      />
    </div>
  );
}

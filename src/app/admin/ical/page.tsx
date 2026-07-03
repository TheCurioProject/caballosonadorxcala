import prisma from '@/lib/prisma';
import React from 'react';
import IcalWorkspace from './IcalWorkspace';

export const dynamic = 'force-dynamic';

export default async function AdminICalPage() {
  let property = await prisma.property.findFirst({
    include: {
      icalSources: true
    }
  });

  if (!property) {
    property = await prisma.property.create({
      data: {
        name: 'Casa del Caballo Soñador',
        baseCapacity: 12,
        basePrice: 1500
      },
      include: {
        icalSources: true
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-4xl font-serif text-[#23211F]">iCal Integrations</h2>
        <p className="text-gray-500 font-light mt-2">
          Sync your property availability with external channels like Airbnb and Booking.com.
        </p>
      </div>

      <IcalWorkspace 
        roomId={property.id}
        initialFeeds={property.icalSources.map(f => ({ name: f.name, url: f.url }))}
      />
    </div>
  );
}

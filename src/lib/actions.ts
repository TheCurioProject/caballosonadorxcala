'use server';

import prisma from './prisma';
import * as ical from 'node-ical';
import { revalidatePath } from 'next/cache';

export async function setDailyRates(propertyId: number, dates: Date[], price: number) {
  for (const date of dates) {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    await prisma.pricingRule.upsert({
      where: {
        propertyId_date: {
          propertyId,
          date: d
        }
      },
      update: { priceOverride: price },
      create: { propertyId, date: d, priceOverride: price }
    });
  }
  revalidatePath('/admin/calendar');
}

export async function toggleBlockDates(propertyId: number, dates: Date[], block: boolean) {
  if (block) {
    for (const date of dates) {
      const d = new Date(date);
      d.setHours(0,0,0,0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);

      // Check if already blocked to avoid duplicates
      const existing = await prisma.booking.findFirst({
        where: {
          propertyId,
          checkIn: d,
          origin: 'MANUAL_BLOCK'
        }
      });

      if (!existing) {
        await prisma.booking.create({
          data: {
            propertyId,
            checkIn: d,
            checkOut: nextDay,
            guestName: 'Bloqueo Manual',
            guestEmail: 'admin@casacaballosonador.com',
            origin: 'MANUAL_BLOCK',
            totalPrice: 0,
            payment_status: 'PAID'
          }
        });
      }
    }
  } else {
    // Unblock
    for (const date of dates) {
      const d = new Date(date);
      d.setHours(0,0,0,0);
      
      await prisma.booking.deleteMany({
        where: {
          propertyId,
          checkIn: d,
          origin: 'MANUAL_BLOCK'
        }
      });
    }
  }
  revalidatePath('/admin/calendar');
  revalidatePath('/admin');
}

export async function saveIcalFeeds(propertyId: number, feeds: { name: string; url: string }[]) {
  // Overwrite all feeds for simplicity
  await prisma.icalSource.deleteMany({ where: { propertyId } });
  
  if (feeds.length > 0) {
    await prisma.icalSource.createMany({
      data: feeds.map(f => ({ propertyId, name: f.name, url: f.url }))
    });
  }

  revalidatePath('/admin/ical');
}

export async function updatePropertySettings(propertyId: number, price: number, minNights: number) {
  await prisma.property.update({
    where: { id: propertyId },
    data: { basePrice: price }
  });
  revalidatePath('/admin/calendar');
}

export async function addBlockedDate(propertyId: number, startDate: Date, endDate: Date, reason?: string) {
  await prisma.blockedDate.create({
    data: {
      propertyId,
      startDate,
      endDate,
      reason
    }
  });
  revalidatePath('/admin/calendar');
}

export async function removeBlockedDate(id: number) {
  await prisma.blockedDate.delete({ where: { id } });
  revalidatePath('/admin/calendar');
}

export async function createManualBooking(propertyId: number, checkIn: Date, checkOut: Date, guestName: string, guestEmail: string) {
  await prisma.booking.create({
    data: {
      propertyId,
      checkIn,
      checkOut,
      guestName,
      guestEmail,
      origin: 'MANUAL',
      totalPrice: 0,
      payment_status: 'CONFIRMED'
    }
  });
  revalidatePath('/admin/calendar');
}

export async function addHolidayRule(propertyId: number, name: string, startDate: Date, endDate: Date, price: number, minNights: number) {
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const d = new Date(current);
    await prisma.pricingRule.upsert({
      where: {
        propertyId_date: {
          propertyId,
          date: d
        }
      },
      update: { priceOverride: price },
      create: { propertyId, date: d, priceOverride: price }
    });
    current.setDate(current.getDate() + 1);
  }
  revalidatePath('/admin/calendar');
}

export async function removeHolidayRule(id: number) {
  await prisma.pricingRule.delete({ where: { id } });
  revalidatePath('/admin/calendar');
}
export async function syncIcalSources(propertyId: number) {
  const sources = await prisma.icalSource.findMany({ where: { propertyId } });
  if (sources.length === 0) return;

  for (const source of sources) {
    try {
      const events = await ical.async.fromURL(source.url);
      
      // Delete previous blocks from this specific source
      await prisma.blockedDate.deleteMany({
        where: { propertyId, source: `ical-${source.id}` }
      });

      // Fetch our existing internal bookings and manual blocks to prevent double-blocking
      const internalBookings = await prisma.booking.findMany({
        where: { propertyId, origin: { not: 'ICAL_SYNC' } }
      });
      const manualBlocks = await prisma.blockedDate.findMany({
        where: { propertyId, source: 'manual' }
      });

      const newBlocks: any[] = [];

      for (const key in events) {
        const ev = events[key];
        if (ev.type === 'VEVENT') {
          const start = new Date(ev.start as Date);
          const end = new Date(ev.end as Date);
          
          if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

          // Check for overlap with internal bookings
          const bookingOverlap = internalBookings.some(b => 
            (start < b.checkOut && end > b.checkIn)
          );
          
          // Check for overlap with manual blocks
          const blockOverlap = manualBlocks.some(b => 
            (start < b.endDate && end > b.startDate)
          );

          const summaryText = typeof ev.summary === 'string' ? ev.summary : (ev.summary?.val || 'External Sync');

          if (!bookingOverlap && !blockOverlap) {
            newBlocks.push({
              propertyId,
              startDate: start,
              endDate: end,
              reason: summaryText,
              source: `ical-${source.id}`
            });
          }
        }
      }

      if (newBlocks.length > 0) {
        await prisma.blockedDate.createMany({ data: newBlocks });
      }

      // Update source status to success
      await prisma.icalSource.update({
        where: { id: source.id },
        data: { syncStatus: 'success', lastSync: new Date(), syncError: null }
      });
    } catch (error: any) {
      console.error(`Error syncing iCal source ${source.name}:`, error);
      // Update source status to error
      await prisma.icalSource.update({
        where: { id: source.id },
        data: { syncStatus: 'error', syncError: error.message || 'Unknown error' }
      });
    }
  }
  
  revalidatePath('/admin/calendar');
  revalidatePath('/admin/ical');
}

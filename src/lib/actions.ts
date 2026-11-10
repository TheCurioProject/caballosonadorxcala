'use server';

import { assertAvailability } from '@/lib/reservations';

import { requireAdmin } from '@/lib/auth';

import prisma from './prisma';
import { revalidatePath } from 'next/cache';

export async function setDailyRates(propertyId: number, dates: Date[], price: number) {
  await requireAdmin();
  for (const date of dates) {
    const d = new Date(date);
    d.setUTCHours(0,0,0,0);
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
  await requireAdmin();
  if (block) {
    for (const date of dates) {
      const d = new Date(date);
      d.setUTCHours(0,0,0,0);
      const nextDay = new Date(d);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);

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
      d.setUTCHours(0,0,0,0);

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
  await requireAdmin();
  if (!Number.isSafeInteger(propertyId) || propertyId < 1 || !Array.isArray(feeds) || feeds.length > 20) throw new Error('Invalid feeds');
  const urls = new Set<string>();
  for (const feed of feeds) {
    const url = new URL(feed.url);
    if (!['https:', 'http:'].includes(url.protocol) || !feed.name.trim() || feed.name.length > 255 || urls.has(feed.url)) throw new Error('Invalid or duplicate feed');
    urls.add(feed.url);
  }
  await prisma.$transaction(async tx => {
    const previous = await tx.icalSource.findMany({ where: { propertyId } });
    const removed = previous.filter(source => !urls.has(source.url));
    if (removed.length) {
      await tx.blockedDate.deleteMany({ where: { propertyId, source: { in: removed.map(source => `ical-${source.id}`) } } });
      await tx.icalSource.deleteMany({ where: { id: { in: removed.map(source => source.id) } } });
    }
    for (const feed of feeds) {
      const existing = previous.find(source => source.url === feed.url);
      if (existing) await tx.icalSource.update({ where: { id: existing.id }, data: { name: feed.name } });
      else await tx.icalSource.create({ data: { propertyId, name: feed.name, url: feed.url } });
    }
  });

  // Auto-verificar y sincronizar inmediatamente los feeds recién guardados
  const syncResult = await syncAllIcalFeeds(propertyId);
  const updatedSources = await prisma.icalSource.findMany({ where: { propertyId } });

  revalidatePath('/admin/ical');
  revalidatePath('/admin/calendar');

  return {
    syncResult,
    sources: updatedSources.map(f => ({
      id: f.id,
      name: f.name,
      url: f.url,
      syncStatus: f.syncStatus,
      lastSync: f.lastSync,
      syncError: f.syncError
    }))
  };
}

export async function verifyAndSyncIcalSources(propertyId: number) {
  await requireAdmin();
  const syncResult = await syncAllIcalFeeds(propertyId);
  const updatedSources = await prisma.icalSource.findMany({
    where: { propertyId }
  });
  return {
    syncResult,
    sources: updatedSources.map(f => ({
      id: f.id,
      name: f.name,
      url: f.url,
      syncStatus: f.syncStatus,
      lastSync: f.lastSync,
      syncError: f.syncError
    }))
  };
}


export async function updatePropertySettings(propertyId: number, price: number, minNights: number) {
  await requireAdmin();
  await prisma.property.update({
    where: { id: propertyId },
    data: { basePrice: price }
  });
  revalidatePath('/admin/calendar');
}

export async function addBlockedDate(propertyId: number, startDate: Date, endDate: Date, reason?: string) {
  await requireAdmin();
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
  await requireAdmin();
  await prisma.blockedDate.delete({ where: { id } });
  revalidatePath('/admin/calendar');
}

export async function createManualBooking(propertyId: number, checkIn: Date, checkOut: Date, guestName: string, guestEmail: string) {
  await requireAdmin();
  await prisma.$transaction(async tx => {
    await assertAvailability(tx, propertyId, checkIn, checkOut);
    return tx.booking.create({
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
  });
  revalidatePath('/admin/calendar');
}

export async function addHolidayRule(propertyId: number, name: string, startDate: Date, endDate: Date, price: number, minNights: number) {
  await requireAdmin();
  const current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);

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
    current.setUTCDate(current.getUTCDate() + 1);
  }
  revalidatePath('/admin/calendar');
}

export async function removeHolidayRule(id: number) {
  await requireAdmin();
  await prisma.pricingRule.delete({ where: { id } });
  revalidatePath('/admin/calendar');
}
import { syncAllIcalFeeds } from './icalSync';

export async function syncIcalSources(propertyId: number) {
  await requireAdmin();
  return await syncAllIcalFeeds(propertyId);
}

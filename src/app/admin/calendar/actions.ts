'use server';

import { requireAdmin } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { calendarDayInterval, subtractInterval } from '@/lib/dateRanges';

function validateSelection(propertyId: number, dates: Date[]) {
  if (!Number.isSafeInteger(propertyId) || propertyId < 1 || !Array.isArray(dates) || dates.length > 366 ||
      dates.some(date => !Number.isFinite(new Date(date).getTime()))) throw new Error('Invalid dates');
}

export async function toggleBlockDates(propertyId: number, dates: Date[], isBlocking: boolean, reason = 'Manual block') {
  await requireAdmin();
  validateSelection(propertyId, dates);
  await prisma.$transaction(async tx => {
    for (const date of dates) {
      const interval = calendarDayInterval(new Date(date));
      const overlaps = await tx.blockedDate.findMany({ where: {
        propertyId, source: 'manual', startDate: { lte: interval.endDate }, endDate: { gte: interval.startDate },
      } });
      if (isBlocking) {
        if (!overlaps.some(block => block.startDate <= interval.startDate && block.endDate >= interval.endDate)) {
          await tx.blockedDate.create({ data: { propertyId, ...interval, reason, source: 'manual' } });
        }
      } else {
        for (const block of overlaps) {
          const parts = subtractInterval(block, interval);
          await tx.blockedDate.delete({ where: { id: block.id } });
          if (parts.length) await tx.blockedDate.createMany({ data: parts.map(part => ({ ...part, propertyId, source: 'manual', reason: block.reason })) });
        }
      }
    }
  });
  revalidatePath('/admin/calendar');
  revalidatePath('/admin/bookings');
}

export async function setCustomPrices(propertyId: number, dates: Date[], price: number) {
  await requireAdmin();
  validateSelection(propertyId, dates);
  if (!Number.isFinite(price) || price < 0) throw new Error('Invalid price');
  await prisma.$transaction(dates.map(value => {
    const date = calendarDayInterval(new Date(value)).startDate;
    return prisma.pricingRule.upsert({
      where: { propertyId_date: { propertyId, date } },
      create: { propertyId, date, priceOverride: price }, update: { priceOverride: price },
    });
  }));
  revalidatePath('/admin/calendar');
}

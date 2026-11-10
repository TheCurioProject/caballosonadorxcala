'use server';

import { revalidatePublicSite } from '@/lib/revalidatePublic';
import { requireAdmin } from '@/lib/auth';

import prisma from '@/lib/prisma';
import { calendarDayInterval, subtractInterval } from '@/lib/dateRanges';
import { revalidatePath } from 'next/cache';

export async function toggleServiceBlockDates(serviceType: string, dates: Date[], isBlocking: boolean) {
  await requireAdmin();
  if (!['FOOD', 'TOUR'].includes(serviceType) || dates.length > 366 || dates.some(date => !Number.isFinite(new Date(date).getTime()))) throw new Error('Invalid dates');
  await prisma.$transaction(async tx => {
    for (const date of dates) {
      const interval = calendarDayInterval(new Date(date));
      const overlaps = await tx.serviceBlockedDate.findMany({ where: { serviceType, startDate: { lte: interval.endDate }, endDate: { gte: interval.startDate } } });
      if (isBlocking) {
        if (!overlaps.some(block => block.startDate <= interval.startDate && block.endDate >= interval.endDate)) {
          await tx.serviceBlockedDate.create({ data: { serviceType, ...interval, reason: 'Bloqueo manual' } });
        }
      } else {
        for (const block of overlaps) {
          const parts = subtractInterval(block, interval);
          await tx.serviceBlockedDate.delete({ where: { id: block.id } });
          if (parts.length) await tx.serviceBlockedDate.createMany({ data: parts.map(part => ({ ...part, serviceType, reason: block.reason })) });
        }
      }
    }
  });

  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  revalidatePublicSite();
}

export async function getServiceBlockedDates() {
  await requireAdmin();
  try {
    const blocks = await prisma.serviceBlockedDate.findMany({
      where: {
        endDate: { gte: new Date() }
      }
    });
    return blocks;
  } catch (error) {
    console.error("Failed to fetch service blocked dates (table might not exist):", error);
    return [];
  }
}

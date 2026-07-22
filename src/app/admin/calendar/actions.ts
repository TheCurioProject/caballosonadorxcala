'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function toggleBlockDates(propertyId: number, dates: Date[], isBlocking: boolean, reason: string = 'Bloqueo manual') {
  for (const date of dates) {
    const startDate = new Date(date);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setUTCHours(23, 59, 59, 999);

    const existingBlock = await prisma.blockedDate.findFirst({
      where: {
        propertyId,
        startDate: { lte: startDate },
        endDate: { gte: startDate },
      }
    });

    if (existingBlock && !isBlocking) {
      await prisma.blockedDate.delete({ where: { id: existingBlock.id } });
    } else if (!existingBlock && isBlocking) {
      await prisma.blockedDate.create({
        data: {
          propertyId,
          startDate: startDate,
          endDate: endDate,
          reason
        }
      });
    }
  }

  revalidatePath('/admin/calendar');
}

export async function setCustomPrices(propertyId: number, dates: Date[], price: number) {
  for (const date of dates) {
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);

    // Upsert the daily rate
    const existingRate = await prisma.pricingRule.findFirst({
      where: { propertyId, date: targetDate }
    });

    if (existingRate) {
      await prisma.pricingRule.update({
        where: { id: existingRate.id },
        data: { priceOverride: price }
      });
    } else {
      await prisma.pricingRule.create({
        data: { propertyId, date: targetDate, priceOverride: price }
      });
    }
  }

  revalidatePath('/admin/calendar');
}

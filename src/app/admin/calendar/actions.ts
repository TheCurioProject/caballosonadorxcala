'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function toggleBlockDate(propertyId: number, date: Date, reason: string = 'Bloqueo manual') {
  // Check if date is blocked
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

  if (existingBlock) {
    // If it's a multi-day block, this is tricky. For simplicity, we just delete the whole block.
    await prisma.blockedDate.delete({ where: { id: existingBlock.id } });
  } else {
    // Add block for this single day
    await prisma.blockedDate.create({
      data: {
        propertyId,
        startDate: startDate,
        endDate: endDate,
        reason
      }
    });
  }

  revalidatePath('/admin/calendar');
}

export async function setCustomPrice(propertyId: number, date: Date, price: number) {
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

  revalidatePath('/admin/calendar');
}

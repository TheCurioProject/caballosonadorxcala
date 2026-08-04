'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function toggleServiceBlockDates(serviceType: string, dates: Date[], isBlocking: boolean) {
  if (dates.length === 0) return;

  if (isBlocking) {
    const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
    const startDate = sorted[0];
    const endDate = sorted[sorted.length - 1];
    
    // Set to start and end of day using local time for simple blocking
    // Actually, it's safer to just push the boundaries to catch the dates
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    await prisma.serviceBlockedDate.create({
      data: {
        serviceType,
        startDate: new Date(`${startStr}T00:00:00Z`),
        endDate: new Date(`${endStr}T23:59:59Z`),
        reason: 'Bloqueo manual',
      }
    });
  } else {
    // Unblock by deleting any blocks that overlap with the selected dates
    const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
    const startStr = sorted[0].toISOString().split('T')[0];
    const endStr = sorted[sorted.length - 1].toISOString().split('T')[0];
    
    const start = new Date(`${startStr}T00:00:00Z`);
    const end = new Date(`${endStr}T23:59:59Z`);

    await prisma.serviceBlockedDate.deleteMany({
      where: {
        serviceType,
        startDate: { lte: end },
        endDate: { gte: start }
      }
    });
  }
  
  revalidatePath('/admin/settings');
  revalidatePath('/admin');
}

export async function getServiceBlockedDates() {
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

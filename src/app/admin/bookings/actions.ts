'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function removeBooking(id: number) {
  if (!isNaN(id)) {
    await prisma.booking.delete({ where: { id } });
    revalidatePath('/admin/bookings');
    revalidatePath('/admin/calendar');
  }
}

export async function clearPendingBookings(all: boolean = false) {
  try {
    const whereClause: any = { payment_status: 'PENDING' };
    
    if (!all) {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      whereClause.createdAt = { lt: fifteenMinutesAgo };
    }
    
    const result = await prisma.booking.deleteMany({
      where: whereClause
    });
    
    revalidatePath('/admin/bookings');
    revalidatePath('/admin/calendar');
    
    return { success: true, count: result.count };
  } catch (error) {
    console.error('Error clearing pending bookings:', error);
    return { success: false, error: 'Failed to clear pending bookings' };
  }
}

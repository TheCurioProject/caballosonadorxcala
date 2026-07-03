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

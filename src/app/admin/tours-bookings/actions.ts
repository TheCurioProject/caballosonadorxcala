'use server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function removeTourBooking(bookingId: number) {
  try {
    await prisma.serviceBooking.delete({
      where: { id: bookingId }
    });
    revalidatePath('/admin/tours-bookings');
    revalidatePath('/admin/calendar');
    revalidatePath('/admin/bookings');
  } catch (error) {
    console.error('Failed to delete tour booking:', error);
    throw new Error('Failed to delete tour booking');
  }
}

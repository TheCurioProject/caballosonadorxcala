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

export async function updateBooking(bookingId: number, formData: FormData) {
  try {
    const checkIn = new Date(formData.get('checkIn') as string);
    const checkOut = new Date(formData.get('checkOut') as string);
    const guestName = formData.get('guestName') as string;
    const guestEmail = formData.get('guestEmail') as string || 'manual@reserva.com';
    const guestPhone = formData.get('guestPhone') as string || null;
    const price = parseFloat(formData.get('price') as string);
    const depositPaid = parseFloat(formData.get('depositPaid') as string) || 0;
    const depositCurrency = formData.get('depositCurrency') as string || 'MXN';

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return { success: false, error: 'Invalid dates' };
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        checkIn,
        checkOut,
        guestName,
        guestEmail,
        guestPhone,
        totalPrice: isNaN(price) ? 0 : price,
        depositPaid,
        depositCurrency
      }
    });

    revalidatePath('/admin/bookings');
    revalidatePath('/admin/calendar');
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Database error while updating' };
  }
}

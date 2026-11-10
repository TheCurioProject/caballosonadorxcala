'use server';

import { assertAvailability } from '@/lib/reservations';

import { requireAdmin } from '@/lib/auth';

import prisma from '@/lib/prisma';
import { HOLD_MILLISECONDS } from '@/lib/bookingPolicy';
import { revalidatePath } from 'next/cache';

export async function removeBooking(id: number) {
  await requireAdmin();
  if (!isNaN(id)) {
    await prisma.booking.delete({ where: { id } });
    revalidatePath('/admin/bookings');
    revalidatePath('/admin/calendar');
  }
}

export async function clearPendingBookings(all: boolean = false) {
  await requireAdmin();
  try {
    const whereClause: any = { payment_status: 'PENDING' };
    
    if (!all) {
      const fifteenMinutesAgo = new Date(Date.now() - HOLD_MILLISECONDS);
      whereClause.createdAt = { lt: fifteenMinutesAgo };
    }
    
    const result = await prisma.booking.updateMany({
      where: whereClause,
      data: { payment_status: 'EXPIRED' }
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
  await requireAdmin();
  try {
    const checkIn = new Date(formData.get('checkIn') as string);
    const checkOut = new Date(formData.get('checkOut') as string);
    const guestName = formData.get('guestName') as string;
    const guestEmail = formData.get('guestEmail') as string || 'manual@reserva.com';
    const guestPhone = formData.get('guestPhone') as string || null;
    const price = parseFloat(formData.get('price') as string);
    const depositPaid = parseFloat(formData.get('depositPaid') as string) || 0;
    const depositCurrency = formData.get('depositCurrency') as string || 'MXN';
    const invoiceLanguage = formData.get('invoiceLanguage') as string || 'en';

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkOut <= checkIn) {
      return { success: false, error: 'Invalid dates' };
    }

    await prisma.$transaction(async tx => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      const datesChanged = booking.checkIn.toISOString().slice(0, 10) !== checkIn.toISOString().slice(0, 10) ||
        booking.checkOut.toISOString().slice(0, 10) !== checkOut.toISOString().slice(0, 10);
      if (datesChanged) await assertAvailability(tx, booking.propertyId, checkIn, checkOut, bookingId);
      return tx.booking.update({
      where: { id: bookingId },
      data: {
        checkIn,
        checkOut,
        guestName,
        guestEmail,
        guestPhone,
        totalPrice: isNaN(price) ? 0 : price,
        depositPaid,
        depositCurrency,
        invoiceLanguage
      }
      });
    });

    revalidatePath('/admin/bookings');
    revalidatePath('/admin/calendar');
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: e instanceof Error && e.message === 'DATES_UNAVAILABLE' ? 'Fechas no disponibles' : 'Database error while updating' };
  }
}

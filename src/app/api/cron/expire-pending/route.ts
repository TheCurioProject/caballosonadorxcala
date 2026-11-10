import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { HOLD_MILLISECONDS } from '@/lib/bookingPolicy';
import { isCronAuthorized } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const createdAt = { lt: new Date(Date.now() - HOLD_MILLISECONDS) };
    const [bookings, services] = await prisma.$transaction([
      prisma.booking.updateMany({ where: { payment_status: 'PENDING', origin: 'WEBSITE', createdAt }, data: { payment_status: 'EXPIRED' } }),
      prisma.serviceBooking.updateMany({ where: { paymentStatus: 'PENDING', externalId: { not: null }, createdAt }, data: { paymentStatus: 'EXPIRED' } }),
    ]);
    return NextResponse.json({ bookings: bookings.count, services: services.count });
  } catch (error) {
    console.error('[Cron] Expiration failed', error);
    return NextResponse.json({ error: 'Expiration failed' }, { status: 500 });
  }
}

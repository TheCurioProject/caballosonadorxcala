import type { Prisma } from '@prisma/client';
import { activeBookingWhere } from '@/lib/bookingPolicy';

export async function assertAvailability(tx: Prisma.TransactionClient, propertyId: number, checkIn: Date, checkOut: Date, excludeId?: number) {
  if (!Number.isSafeInteger(propertyId) || propertyId < 1 || !Number.isFinite(checkIn.getTime()) ||
      !Number.isFinite(checkOut.getTime()) || checkOut <= checkIn) throw new Error('INVALID_DATES');
  if(process.env.DATA_BACKEND==='supabase') await tx.$queryRaw`SELECT id FROM site.properties WHERE id = ${propertyId} FOR UPDATE`;
  else await tx.$queryRaw`SELECT id FROM properties WHERE id = ${propertyId} FOR UPDATE`;
  const booking = await tx.booking.findFirst({ where: {
    propertyId, ...activeBookingWhere(), ...(excludeId ? { id: { not: excludeId } } : {}),
    checkIn: { lte: checkOut }, checkOut: { gte: checkIn },
  } });
  const block = await tx.blockedDate.findFirst({ where: { propertyId, startDate: { lte: checkOut }, endDate: { gte: checkIn } } });
  if (booking || block) throw new Error('DATES_UNAVAILABLE');
}

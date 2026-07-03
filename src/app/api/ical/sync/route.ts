import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Simple authorization to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev-secret'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sources = await prisma.icalSource.findMany({
      include: { property: true }
    });

    let importedCount = 0;
    let updatedCount = 0;

    for (const source of sources) {
      if (!source.url) continue;

      try {
        const ical = (await import('node-ical')).default;
        const events = await ical.async.fromURL(source.url);
        
        for (const event of Object.values(events)) {
          if (event && event.type === 'VEVENT') {
            const externalId = event.uid;
            const checkIn = event.start;
            const checkOut = event.end;

            if (!externalId || !checkIn || !checkOut) continue;

            // Check if booking already exists
            const existingBooking = await prisma.booking.findUnique({
              where: { externalId },
            });

            if (existingBooking) {
              // Update if dates changed
              if (
                existingBooking.checkIn.getTime() !== checkIn.getTime() ||
                existingBooking.checkOut.getTime() !== checkOut.getTime()
              ) {
                await prisma.booking.update({
                  where: { id: existingBooking.id },
                  data: { checkIn, checkOut },
                });
                updatedCount++;
              }
            } else {
              // Create new booking
              await prisma.booking.create({
                data: {
                  propertyId: source.propertyId,
                  checkIn,
                  checkOut,
                  guestName: 'Reserva Externa',
                  guestEmail: 'no-reply@external.com',
                  origin: 'ICAL_SYNC',
                  totalPrice: 0,
                  payment_status: 'PAID',
                  externalId,
                },
              });
              importedCount++;
            }
          }
        }
      } catch (err) {
        console.error(`Failed to sync calendar for property ${source.propertyId} from ${source.url}`, err);
        // Continue with other sources
      }
    }

    return NextResponse.json({ success: true, importedCount, updatedCount });
  } catch (error) {
    console.error('Error syncing iCal:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';


// Vercel Cron Job endpoint (ej. cada hora)
export async function GET(request: Request) {
  // Opcional: Proteger con Authorization Header o secreto de Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const sources = await prisma.icalSource.findMany();

    let importedCount = 0;

    for (const source of sources) {
      if (!source.url) continue;
      
      try {
        const ical = (await import('node-ical')).default;
        const events = await ical.async.fromURL(source.url);
        
        for (const event of Object.values(events)) {
          if (event && event.type === 'VEVENT') {
            const externalId = event.uid;
            if (!externalId) continue;
            
            // Verificar si la reserva ya existe
            const existing = await prisma.booking.findUnique({
              where: { externalId }
            });

            if (!existing && event.start && event.end) {
              const isAirbnb = source.url.toLowerCase().includes('airbnb') || source.name.toLowerCase().includes('airbnb') || (event.summary && typeof event.summary === 'string' && event.summary.toLowerCase().includes('airbnb'));
              await prisma.booking.create({
                data: {
                  propertyId: source.propertyId,
                  checkIn: event.start,
                  checkOut: event.end,
                  guestName: (typeof event.summary === 'string' ? event.summary : event.summary?.val) || 'Reserva Externa',
                  guestEmail: 'no-reply@external.com',
                  origin: isAirbnb ? 'AIRBNB' : 'EXTERNAL',
                  totalPrice: 0,
                  externalId: externalId,
                  payment_status: 'PAID'
                }
              });
              importedCount++;
            }
          }
        }
      } catch (err) {
        console.error(`Error sync source ${source.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, imported: importedCount });
  } catch (error) {
    console.error('iCal Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

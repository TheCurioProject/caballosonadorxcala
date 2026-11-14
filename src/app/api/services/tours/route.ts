import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { listTours } from '@/lib/tours.server';

/** Active tours for the booking modal, in the order chosen in CALA → ATV Tours. */
export async function GET() {
  try {
    const tours = await listTours({ activeOnly: true });
    if (tours) {
      return NextResponse.json(tours.map(t => ({
        id: t.id,
        // Same (possibly bilingual JSON) text the booking modal, Stripe and invoices already use.
        name: t.bookingName,
        description: t.bookingDescription,
        pricePerPax: t.pricePerPax,
        isActive: t.isActive,
        image: t.images[0] ?? null,
      })));
    }
    const destinations = await prisma.tourDestination.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' }
    });
    return NextResponse.json(destinations);
  } catch (error) {
    console.error('Error fetching tour destinations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const destinations = await prisma.tourDestination.findMany({
      orderBy: { id: 'asc' }
    });
    return NextResponse.json(destinations);
  } catch (error) {
    console.error('Error fetching tour destinations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, name, pricePerPax, isActive } = body;

    const updated = await prisma.tourDestination.upsert({
      where: { id: id || 0 },
      update: { name, pricePerPax, isActive },
      create: { name, pricePerPax, isActive }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error saving tour destination:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

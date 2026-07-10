import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const services = await prisma.servicePricing.findMany({
      where: { serviceType: 'FOOD' },
      orderBy: { id: 'asc' }
    });
    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching food services:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, name, price, isActive } = body;

    const updated = await prisma.servicePricing.upsert({
      where: { id: id || 0 },
      update: { name, price, isActive },
      create: { serviceType: 'FOOD', name, price, isActive }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error saving food service:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

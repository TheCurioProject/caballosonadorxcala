import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

import prisma from '@/lib/prisma';

export async function GET() {
  try {
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

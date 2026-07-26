import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const pricing = await prisma.servicePricing.findMany({
      where: { 
        serviceType: { in: ['FOOD_SERVICE', 'FOOD_PRICE', 'FOOD_DISH', 'FOOD'] },
        isActive: true 
      },
      orderBy: { id: 'asc' }
    });
    return NextResponse.json(pricing);
  } catch (error) {
    console.error('Error fetching food pricing:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let property = await prisma.property.findFirst();
    if (!property) {
      property = await prisma.property.create({
        data: {
          name: 'Casa Caballo Soñador',
          baseCapacity: 12,
          basePrice: 1500
        }
      });
    }
    return NextResponse.json({
      usd: property.exchangeRateUsd || 18.8,
      cad: property.exchangeRateCad || 17.7
    });
  } catch (error) {
    return NextResponse.json({ usd: 18.8, cad: 17.7 });
  }
}

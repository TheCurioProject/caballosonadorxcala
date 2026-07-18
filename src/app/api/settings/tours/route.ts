import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let property = await prisma.property.findFirst();
    
    // If no property exists, we return defaults or create one
    if (!property) {
      property = await prisma.property.create({
        data: {
          name: 'Casa Caballo Soñador',
          minTourPax: 3,
          maxTourPax: 10
        }
      });
    }

    return NextResponse.json({
      minTourPax: property.minTourPax ?? 3,
      maxTourPax: property.maxTourPax ?? 10
    });
  } catch (error) {
    console.error('Error fetching tour settings:', error);
    return NextResponse.json({ minTourPax: 3, maxTourPax: 10 });
  }
}

export async function POST(req: Request) {
  try {
    const { minTourPax, maxTourPax } = await req.json();

    let property = await prisma.property.findFirst();
    if (!property) {
      property = await prisma.property.create({
        data: {
          name: 'Casa Caballo Soñador',
          minTourPax: parseInt(minTourPax, 10),
          maxTourPax: parseInt(maxTourPax, 10)
        }
      });
    } else {
      property = await prisma.property.update({
        where: { id: property.id },
        data: {
          minTourPax: parseInt(minTourPax, 10),
          maxTourPax: parseInt(maxTourPax, 10)
        }
      });
    }

    return NextResponse.json({ success: true, minTourPax: property.minTourPax, maxTourPax: property.maxTourPax });
  } catch (error) {
    console.error('Error updating tour settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

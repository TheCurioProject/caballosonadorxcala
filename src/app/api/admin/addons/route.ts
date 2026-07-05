import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const addons = await prisma.addonPricing.findMany({
      orderBy: { id: 'asc' }
    });
    return NextResponse.json(addons);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching addons' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, name, price, isActive } = await req.json();

    if (!type || !name || price === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const addon = await prisma.addonPricing.upsert({
      where: { type },
      update: {
        name,
        price: parseFloat(price),
        isActive: isActive !== undefined ? isActive : true,
      },
      create: {
        type,
        name,
        price: parseFloat(price),
        isActive: isActive !== undefined ? isActive : true,
      }
    });

    return NextResponse.json(addon);
  } catch (error) {
    console.error('Error saving addon:', error);
    return NextResponse.json({ error: 'Error saving addon' }, { status: 500 });
  }
}

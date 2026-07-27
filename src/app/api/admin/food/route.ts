import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTranslations } from '@/lib/translate';

export async function GET() {
  try {
    const services = await prisma.servicePricing.findMany({
      where: { 
        serviceType: {
          in: ['FOOD_SERVICE', 'FOOD_PRICE', 'FOOD_DISH', 'FOOD']
        }
      },
      orderBy: { id: 'asc' }
    });

    const parseTranslation = (str: string | undefined | null) => {
      if (!str) return '';
      if (str.startsWith('{') && str.endsWith('}')) {
        try {
          const parsed = JSON.parse(str);
          return parsed.es || parsed.en || str;
        } catch (e) {}
      }
      return str;
    };

    const formatted = services.map(s => ({
      ...s,
      name: parseTranslation(s.name),
      description: parseTranslation(s.description)
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching food services:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, name, description, price, isActive, serviceType } = body;

    const type = serviceType || 'FOOD_PRICE';

    const nameJson = JSON.stringify(await getTranslations(name || ''));
    const descJson = JSON.stringify(await getTranslations(description || ''));

    const updated = await prisma.servicePricing.upsert({
      where: { id: id || 0 },
      update: { name: nameJson, description: descJson, price, isActive },
      create: { serviceType: type, name: nameJson, description: descJson, price, isActive }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error saving food service:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = parseInt(url.searchParams.get('id') || '0');
    if (id > 0) {
      await prisma.servicePricing.delete({ where: { id } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting food service:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

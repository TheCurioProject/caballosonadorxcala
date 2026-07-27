import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTranslations } from '@/lib/translate';

export async function GET() {
  try {
    const destinations = await prisma.tourDestination.findMany({
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

    const formatted = destinations.map(d => ({
      ...d,
      name: parseTranslation(d.name),
      description: parseTranslation(d.description)
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching tour destinations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, name, pricePerPax, isActive, description } = body;

    const nameJson = JSON.stringify(await getTranslations(name || ''));
    let descJson = null;
    if (description) {
      descJson = JSON.stringify(await getTranslations(description));
    }

    const updated = await prisma.tourDestination.upsert({
      where: { id: id || 0 },
      update: { name: nameJson, description: descJson, pricePerPax, isActive },
      create: { name: nameJson, description: descJson, pricePerPax, isActive }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error saving tour destination:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

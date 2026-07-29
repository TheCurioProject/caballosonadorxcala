import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { autoTranslate } from '@/lib/translate';

// Extract plain text from a value that might be stored as JSON {"en":"...","es":"..."}
const extractPlainText = (str: string | undefined | null): string => {
  if (!str) return '';
  const trimmed = str.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.original) {
        return parsed.original;
      }
      if (parsed.es || parsed.en) {
        return parsed.es || parsed.en;
      }
    } catch (e) {}
  }
  return str;
};

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

    // Clean any legacy JSON-formatted names to plain text for admin display
    const formatted = services.map(s => ({
      ...s,
      name: extractPlainText(s.name),
      description: extractPlainText(s.description)
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

    // Auto-translate fields before saving
    const plainName = await autoTranslate(name || '');
    const plainDesc = await autoTranslate(description || '');

    const updated = await prisma.servicePricing.upsert({
      where: { id: id || 0 },
      update: { name: plainName, description: plainDesc, price, isActive },
      create: { serviceType: type, name: plainName, description: plainDesc, price, isActive }
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

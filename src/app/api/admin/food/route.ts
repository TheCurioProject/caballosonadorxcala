import { revalidatePublicSite } from '@/lib/revalidatePublic';
import { getSession } from '@/lib/auth';
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
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    const updatedFormatted = {
      ...updated,
      name: extractPlainText(updated.name),
      description: extractPlainText(updated.description)
    };

    revalidatePublicSite();
    return NextResponse.json(updatedFormatted);
  } catch (error) {
    console.error('Error saving food service:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const id = parseInt(url.searchParams.get('id') || '0');
    if (id > 0) {
      await prisma.servicePricing.delete({ where: { id } });
    }
    revalidatePublicSite();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting food service:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

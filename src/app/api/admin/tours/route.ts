import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Extract plain text from a value that might be stored as JSON {"en":"...","es":"..."}
const extractPlainText = (str: string | undefined | null): string => {
  if (!str) return '';
  const trimmed = str.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.es || parsed.en) {
        return parsed.es || parsed.en;
      }
    } catch (e) {}
  }
  return str;
};

export async function GET() {
  try {
    const destinations = await prisma.tourDestination.findMany({
      orderBy: { id: 'asc' }
    });

    const formatted = destinations.map(d => ({
      ...d,
      name: extractPlainText(d.name),
      description: extractPlainText(d.description)
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

    // Store plain text directly — no JSON translation wrapping
    const plainName = name || '';
    const plainDesc = description || null;

    const updated = await prisma.tourDestination.upsert({
      where: { id: id || 0 },
      update: { name: plainName, description: plainDesc, pricePerPax, isActive },
      create: { name: plainName, description: plainDesc, pricePerPax, isActive }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error saving tour destination:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

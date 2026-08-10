import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { autoTranslate } from '@/lib/translate';

const parseTranslation = (jsonStr: string) => {
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return { en: jsonStr, es: jsonStr };
  }
};

export async function GET() {
  try {
    const amenities = await prisma.stayAmenity.findMany({
      orderBy: { id: 'asc' }
    });
    return NextResponse.json(amenities);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch amenities' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const formData = await request.formData();
    const id = parseInt(formData.get('id') as string);
    const title = formData.get('title') as string;
    const short = formData.get('short') as string;
    const desc = formData.get('desc') as string;
    const lang = formData.get('lang') as string; // the language the user edited in ('en' or 'es')

    if (!id || !title || !short || !desc) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const translatedTitle = parseTranslation(await autoTranslate(title));
    const translatedShort = parseTranslation(await autoTranslate(short));
    const translatedDesc = parseTranslation(await autoTranslate(desc));

    const updateData: any = {
      titleEs: translatedTitle.es || title,
      titleEn: translatedTitle.en || title,
      shortEs: translatedShort.es || short,
      shortEn: translatedShort.en || short,
      descEs: translatedDesc.es || desc,
      descEn: translatedDesc.en || desc,
    };

    const amenity = await prisma.stayAmenity.update({
      where: { id },
      data: updateData
    });

    // Revalidate public pages
    revalidatePath('/es');
    revalidatePath('/en');

    return NextResponse.json(amenity);
  } catch (error) {
    console.error('Error updating amenity:', error);
    return NextResponse.json({ error: 'Failed to update amenity' }, { status: 500 });
  }
}

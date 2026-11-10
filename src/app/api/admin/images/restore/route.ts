import { imageSnapshot, isHistoryOf } from '@/lib/imageHistory';
import { DEFAULT_IMAGES } from '@/lib/siteImages';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { key, historyId } = await request.json();

    if (typeof key !== 'string' || !Object.hasOwn(DEFAULT_IMAGES, key) || !Number.isSafeInteger(historyId) || historyId < 1) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const image = await prisma.siteImage.findUnique({ where: { key } });
    if (!image) {
      return NextResponse.json({ error: 'Imagen no encontrada' }, { status: 404 });
    }

    const historyRecord = await prisma.siteImage.findUnique({
      where: { id: historyId }
    });

    if (!historyRecord || !isHistoryOf(historyRecord, image.id)) {
      return NextResponse.json({ error: 'Historial no encontrado' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.siteImage.create({ data: imageSnapshot(image) }),
      prisma.siteImage.update({ where: { id: image.id }, data: { url: historyRecord.url } }),
    ]);

    // Revalidate public pages to reflect changes immediately
    try {
      revalidatePath('/', 'layout');
    } catch (err) {
      console.warn('Revalidation error:', err);
    }

    return NextResponse.json({ success: true, url: historyRecord.url });
  } catch (error) {
    console.error('Error restoring image:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

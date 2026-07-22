import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { key, historyId } = await request.json();

    if (!key || !historyId) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const image = await prisma.siteImage.findUnique({ where: { key } });
    if (!image) {
      return NextResponse.json({ error: 'Imagen no encontrada' }, { status: 404 });
    }

    const historyRecord = await prisma.siteImageHistory.findUnique({
      where: { id: historyId }
    });

    if (!historyRecord || historyRecord.siteImageId !== image.id) {
      return NextResponse.json({ error: 'Historial no encontrado' }, { status: 404 });
    }

    // Save current url to history before restoring
    await prisma.siteImageHistory.create({
      data: {
        siteImageId: image.id,
        url: image.url,
      }
    });

    // Update main image url to the historical one
    await prisma.siteImage.update({
      where: { id: image.id },
      data: { url: historyRecord.url }
    });

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

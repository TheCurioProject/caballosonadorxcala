import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSiteImages } from '@/lib/siteImages.server';
import { revalidateTag } from 'next/cache';

export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'purge') {
    revalidateTag('siteImages', { expire: 0 });
    return NextResponse.json({ message: 'Purged siteImages tag' });
  }

  const dbImages = await prisma.siteImage.findMany();
  const cachedImages = await getSiteImages();

  // Pick one image to compare
  const keyToCompare = '/casaestancia.webp';
  const dbUrl = dbImages.find(img => img.key === keyToCompare)?.url;
  const cachedUrl = cachedImages[keyToCompare]?.url;

  return NextResponse.json({
    dbUrl,
    cachedUrl,
    match: dbUrl === cachedUrl
  });
}

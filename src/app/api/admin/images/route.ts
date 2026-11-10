import { IMAGE_HISTORY_GROUP, imageSnapshot, isHistoryOf } from '@/lib/imageHistory';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { DEFAULT_IMAGES, keyToCloudinaryUrl } from '@/lib/siteImages';
import { v2 as cloudinary } from 'cloudinary';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [dbImages, snapshots] = await Promise.all([
      prisma.siteImage.findMany({ where: { group: { not: IMAGE_HISTORY_GROUP } } }),
      prisma.siteImage.findMany({ where: { group: IMAGE_HISTORY_GROUP }, orderBy: { createdAt: 'desc' } }),
    ]);
    const dbMap = new Map(dbImages.map(img => [img.key, img]));

    // Build image list from DEFAULT_IMAGES + DB override or Cloudinary URL construction
    const responseData = Object.entries(DEFAULT_IMAGES).map(([key, defaultData]) => {
      const dbImg = dbMap.get(key);
      let url = dbImg?.url || defaultData.url || keyToCloudinaryUrl(key);
      
      // Ensure a timestamp is appended so admin panel always bypasses browser cache
      if (dbImg) {
        url = url.includes('?') ? `${url}&t=${dbImg.updatedAt.getTime()}` : `${url}?t=${dbImg.updatedAt.getTime()}`;
      }

      const history = dbImg ? snapshots.filter(snapshot => isHistoryOf(snapshot, dbImg.id)).slice(0, 10).map(snapshot => ({ id: snapshot.id, url: snapshot.url, createdAt: snapshot.createdAt })) : [];
      return {
        key,
        group: defaultData.group,
        name: defaultData.name,
        url,
        hasHistory: history.length > 0,
        history
      };
    });

    // Group by group
    const grouped = responseData.reduce((acc, curr) => {
      if (!acc[curr.group]) acc[curr.group] = [];
      acc[curr.group].push(curr);
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json(grouped);
  } catch (error) {
    console.error('Error fetching images:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const key = formData.get('key') as string;

    if (!file || !key) {
      return NextResponse.json({ error: 'Missing required file or key' }, { status: 400 });
    }

    if (!(file instanceof File) || !Object.hasOwn(DEFAULT_IMAGES, key) || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Invalid image or file exceeds 10 MB' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    // Each replacement has a unique asset ID, so historical URLs remain usable.
    const publicId = 'hotelsonador' + key.replace(/\.[^.]+$/, '') + '-' + crypto.randomUUID();

    try {
      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            overwrite: false,
            invalidate: true, // Purge CDN cache so new image shows immediately
            resource_type: 'image',
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(buffer);
      });

      // The URL from cloudinary contains a unique version hash automatically
      const newUrl = result.secure_url;
      const defaultData = DEFAULT_IMAGES[key];

      await prisma.$transaction(async (tx) => {
        const existing = await tx.siteImage.findUnique({ where: { key } });
        const image = await tx.siteImage.upsert({
          where: { key },
          update: { url: newUrl },
          create: { key, group: defaultData.group, name: defaultData.name, url: newUrl },
        });
        await tx.siteImage.create({ data: imageSnapshot({
          id: image.id, name: image.name,
          url: existing?.url || defaultData.url || keyToCloudinaryUrl(key),
        }) });
      });

      // Clear Next.js cache so the public site immediately reflects the change
      revalidatePath('/', 'layout');

      return NextResponse.json({ success: true, url: newUrl });
    } catch (cloudErr) {
      console.error('Cloudinary upload failed:', cloudErr);
      return NextResponse.json({ error: 'Failed to upload image to Cloudinary' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error uploading image:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage || 'Internal Server Error' }, { status: 500 });
  }
}

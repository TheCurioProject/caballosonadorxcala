import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { DEFAULT_IMAGES } from '@/lib/siteImages';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const images = await prisma.siteImage.findMany({
      include: {
        history: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // Merge with defaults
    const responseData = Object.entries(DEFAULT_IMAGES).map(([key, defaultData]) => {
      const dbImage = images.find(img => img.key === key);
      return {
        key,
        group: defaultData.group,
        name: defaultData.name,
        url: dbImage?.url || defaultData.url,
        hasHistory: dbImage ? dbImage.history.length > 0 : false,
        history: dbImage?.history || []
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
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const key = formData.get('key') as string;

    if (!file || !key) {
      return NextResponse.json({ error: 'Missing required file or key' }, { status: 400 });
    }

    const defaultData = (DEFAULT_IMAGES as any)[key] || {
      group: 'GENERAL',
      name: key.split('/').pop() || key,
      url: key,
    };

    const buffer = Buffer.from(await file.arrayBuffer());
    let newUrl = '';

    // Attempt to write to local disk first
    try {
      const ext = path.extname(file.name) || '.webp';
      const safeKey = key.replace(/[\/\\.]/g, '_');
      const filename = `${safeKey}_${Date.now()}${ext}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'images');

      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(path.join(uploadDir, filename), buffer);
      newUrl = `/uploads/images/${filename}`;
    } catch (fsErr) {
      console.warn('Disk write unavailable, falling back to Base64 Data URI:', fsErr);
      const mimeType = file.type || 'image/webp';
      newUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    }

    // Update DB
    const existingImage = await prisma.siteImage.findUnique({ where: { key } });

    if (existingImage) {
      // Save to history before updating
      await prisma.siteImageHistory.create({
        data: {
          siteImageId: existingImage.id,
          url: existingImage.url,
        }
      });

      await prisma.siteImage.update({
        where: { key },
        data: { url: newUrl }
      });
    } else {
      await prisma.siteImage.create({
        data: {
          key,
          group: defaultData.group || 'GENERAL',
          name: defaultData.name || key,
          url: newUrl
        }
      });
    }

    // Revalidate public pages to reflect changes immediately
    try {
      revalidatePath('/', 'layout');
    } catch (err) {
      console.warn('Revalidation error:', err);
    }

    return NextResponse.json({ success: true, url: newUrl });

  } catch (error) {
    console.error('Error uploading image:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage || 'Internal Server Error' }, { status: 500 });
  }
}

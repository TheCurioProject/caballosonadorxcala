import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import prisma from '@/lib/prisma';
import { DEFAULT_IMAGES } from '@/lib/siteImages';
import fs from 'fs/promises';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

export async function GET() {
  try {
    const images = await prisma.siteImage.findMany();

    // Merge with defaults
    const responseData = Object.entries(DEFAULT_IMAGES).map(([key, defaultData]) => {
      const dbImage = images.find(img => img.key === key);
      return {
        key,
        group: defaultData.group,
        name: defaultData.name,
        url: dbImage?.url || defaultData.url,
        hasHistory: false,
        history: []
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

    // Upload to Cloudinary
    const safeKey = key.replace(/[\/\\.]/g, '_');
    try {
      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: safeKey,
            overwrite: true,
            resource_type: 'image',
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(buffer);
      });
      newUrl = result.secure_url;
    } catch (cloudErr) {
      console.error('Cloudinary upload failed:', cloudErr);
      return NextResponse.json({ error: 'Failed to upload image to Cloudinary' }, { status: 500 });
    }

    // Update DB
    const existingImage = await prisma.siteImage.findUnique({ where: { key } });

    if (existingImage) {
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
      revalidateTag('siteImages');
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

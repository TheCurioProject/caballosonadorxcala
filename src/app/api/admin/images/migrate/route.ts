import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

export async function GET(request: Request) {
  try {
    const imagesToMigrate = await prisma.siteImage.findMany({
      where: {
        url: {
          startsWith: 'data:image'
        }
      }
    });

    if (imagesToMigrate.length === 0) {
      return NextResponse.json({ message: 'No Base64 images found to migrate.' });
    }

    const results = [];

    for (const img of imagesToMigrate) {
      const safeKey = img.key.replace(/[\/\\.]/g, '_');
      
      try {
        const result = await cloudinary.uploader.upload(img.url, {
          public_id: safeKey,
          overwrite: true,
          resource_type: 'image'
        });

        await prisma.siteImage.update({
          where: { id: img.id },
          data: { url: result.secure_url }
        });

        results.push({ key: img.key, status: 'success', newUrl: result.secure_url });
      } catch (err) {
        console.error(`Failed to migrate image ${img.key}:`, err);
        results.push({ key: img.key, status: 'error', error: String(err) });
      }
    }

    return NextResponse.json({
      message: 'Migration complete',
      totalMigrated: results.filter(r => r.status === 'success').length,
      results
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

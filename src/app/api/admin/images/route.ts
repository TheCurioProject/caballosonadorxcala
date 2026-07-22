import { NextResponse } from 'next/server';
import { DEFAULT_IMAGES, keyToCloudinaryUrl } from '@/lib/siteImages';
import { v2 as cloudinary } from 'cloudinary';

export async function GET() {
  try {
    // Build image list purely from DEFAULT_IMAGES + Cloudinary URL construction
    const responseData = Object.entries(DEFAULT_IMAGES).map(([key, defaultData]) => {
      return {
        key,
        group: defaultData.group,
        name: defaultData.name,
        url: defaultData.url || keyToCloudinaryUrl(key),
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

    const buffer = Buffer.from(await file.arrayBuffer());

    // Deterministic public_id: hotelsonador/casaexterior (without extension)
    const publicId = 'hotelsonador' + key.replace(/\.[^.]+$/, '');

    try {
      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            overwrite: true,
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

      // The URL is deterministic: always https://res.cloudinary.com/{cloud}/image/upload/{publicId}
      const newUrl = result.secure_url;

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

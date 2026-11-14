import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export const dynamic = 'force-dynamic';

/** Uploads one tour photo to Cloudinary and returns its URL; the tour itself is saved separately. */
export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const file = (await request.formData()).get('file');
    if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024)
      return NextResponse.json({ error: 'La imagen debe ser JPG, PNG, WebP o AVIF de hasta 10 MB.' }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { public_id: `hotelsonador/tours_gallery/tour-${crypto.randomUUID()}`, overwrite: false, resource_type: 'image' },
          (error, uploaded) => (error || !uploaded ? reject(error ?? new Error('upload failed')) : resolve(uploaded)),
        )
        .end(buffer);
    });
    return NextResponse.json({ url: result.secure_url });
  } catch (error) {
    console.error('Tour image upload failed:', error);
    return NextResponse.json({ error: 'No se pudo subir la imagen a Cloudinary.' }, { status: 502 });
  }
}

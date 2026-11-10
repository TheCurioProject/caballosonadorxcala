import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { DEFAULT_IMAGES } from '@/lib/siteImages';
import { v2 as cloudinary } from 'cloudinary';

export async function POST() {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Re-upload images that were previously uploaded with old naming convention
    // Old convention: public_id = key.replace(/[\/\\.]/g, '_')  e.g. "_rooms_room1_1_webp"
    // New convention: public_id = "hotelsonador" + key without extension  e.g. "hotelsonador/rooms/room1/1"
    
    const keysToMigrate = Object.keys(DEFAULT_IMAGES).filter(k => 
      k.startsWith('/rooms/') || k.startsWith('/imagenes/')
    );

    if (keysToMigrate.length === 0) {
      return NextResponse.json({ message: 'No images to migrate.' });
    }

    const results = [];

    for (const key of keysToMigrate) {
      const oldSafeKey = key.replace(/[\/\\.]/g, '_');
      const oldUrl = `https://res.cloudinary.com/p6nhvksw/image/upload/${oldSafeKey}`;
      const newPublicId = 'hotelsonador' + key.replace(/\.[^.]+$/, '');

      try {
        // Upload from old Cloudinary URL to new public_id
        const result = await cloudinary.uploader.upload(oldUrl, {
          public_id: newPublicId,
          overwrite: true,
          invalidate: true,
          resource_type: 'image'
        });

        results.push({ key, status: 'success', newUrl: result.secure_url });
      } catch (err) {
        // Image might not exist with old naming (never uploaded from admin)
        results.push({ key, status: 'skipped', error: String(err) });
      }
    }

    return NextResponse.json({
      message: 'Migration complete',
      totalMigrated: results.filter(r => r.status === 'success').length,
      totalSkipped: results.filter(r => r.status === 'skipped').length,
      results
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

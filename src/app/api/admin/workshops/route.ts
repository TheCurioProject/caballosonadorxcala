import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';
import { revalidatePath } from 'next/cache';

export async function GET() {
  try {
    const workshops = await prisma.writersWorkshop.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(workshops);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch workshops' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const isActive = formData.get('isActive') === 'true';
    const image = formData.get('image') as File | null;

    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    let imageUrl = null;

    if (image && image.size > 0) {
      const buffer = Buffer.from(await image.arrayBuffer());
      const publicId = `hotelsonador/workshops/ws_${Date.now()}`;
      
      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { public_id: publicId, resource_type: 'image' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(buffer);
      });
      imageUrl = result.secure_url;
    }

    const workshop = await prisma.writersWorkshop.create({
      data: {
        title,
        description,
        isActive,
        imageUrl
      }
    });

    revalidatePath('/es/writers-group');
    revalidatePath('/en/writers-group');

    return NextResponse.json(workshop);
  } catch (error) {
    console.error('Error creating workshop:', error);
    return NextResponse.json({ error: 'Failed to create workshop' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const formData = await request.formData();
    const id = parseInt(formData.get('id') as string);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const isActive = formData.get('isActive') === 'true';
    const image = formData.get('image') as File | null;
    const removeImage = formData.get('removeImage') === 'true';

    if (!id || !title || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const updateData: any = {
      title,
      description,
      isActive
    };

    if (removeImage) {
      updateData.imageUrl = null;
    } else if (image && image.size > 0) {
      const buffer = Buffer.from(await image.arrayBuffer());
      const publicId = `hotelsonador/workshops/ws_${Date.now()}`;
      
      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { public_id: publicId, resource_type: 'image' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(buffer);
      });
      updateData.imageUrl = result.secure_url;
    }

    const workshop = await prisma.writersWorkshop.update({
      where: { id },
      data: updateData
    });

    revalidatePath('/es/writers-group');
    revalidatePath('/en/writers-group');

    return NextResponse.json(workshop);
  } catch (error) {
    console.error('Error updating workshop:', error);
    return NextResponse.json({ error: 'Failed to update workshop' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.writersWorkshop.delete({
      where: { id: parseInt(id) }
    });

    revalidatePath('/es/writers-group');
    revalidatePath('/en/writers-group');

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete workshop' }, { status: 500 });
  }
}

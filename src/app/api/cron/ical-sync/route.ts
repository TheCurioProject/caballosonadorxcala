import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncIcalSources } from '@/lib/actions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for execution

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    
    // Validar el token secreto
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Obtener todas las propiedades
    const properties = await prisma.property.findMany();
    
    for (const property of properties) {
      await syncIcalSources(property.id);
    }

    return NextResponse.json({ success: true, message: 'iCal sync completed successfully' });
  } catch (error: any) {
    console.error('Cron iCal sync error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

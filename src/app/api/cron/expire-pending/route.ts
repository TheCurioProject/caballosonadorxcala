import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Check for Vercel Cron Secret to secure the endpoint
    const authHeader = request.headers.get('authorization');
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    // Log for debugging
    console.log(`Borrando reservas PENDING creadas antes de: ${fifteenMinutesAgo.toISOString()}`);

    const result = await prisma.booking.deleteMany({
      where: {
        payment_status: 'PENDING',
        createdAt: {
          lt: fifteenMinutesAgo
        }
      }
    });

    console.log(`Borradas ${result.count} reservas pendientes caducadas.`);

    return NextResponse.json({ success: true, deletedCount: result.count });
  } catch (error) {
    console.error('Error expirando reservas pendientes:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

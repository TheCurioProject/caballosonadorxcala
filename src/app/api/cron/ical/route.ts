import { isCronAuthorized } from '@/lib/cronAuth';
import { NextResponse } from 'next/server';
import { syncAllIcalFeeds } from '@/lib/icalSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 segundos permitidos en Vercel Functions

export async function GET(request: Request) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Provide Authorization: Bearer <CRON_SECRET> header.'
        },
        { status: 401 }
      );
    }

    console.log('[iCal Cron] Starting automatic synchronization...');
    const result = await syncAllIcalFeeds();
    console.log(`[iCal Cron] Finished. Sources: ${result.totalSources}, Success: ${result.successCount}, Blocks added: ${result.totalBlocks}`);

    return NextResponse.json({
      message: 'iCal sync completed successfully',
      ...result
    });
  } catch (error: any) {
    console.error('[iCal Cron] Execution error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal Server Error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}

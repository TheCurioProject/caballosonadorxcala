import { isCronAuthorized } from '@/lib/cronAuth';
import { NextResponse } from 'next/server';
import { syncAllIcalFeeds } from '@/lib/icalSync';
import { syncAllCalendarLinks } from '@/lib/cala/connectors/calendar-sync';
import { deliverOutbox } from '@/lib/cala/connectors/mail';
import { revalidatePublicSite } from '@/lib/revalidatePublic';

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
    // CALA OTA connectors: calendars of every unit and queued guest replies.
    const calendars = await syncAllCalendarLinks(30000).catch((e) => ({ error: String(e?.message ?? e) }));
    const outbox = await deliverOutbox(30).catch((e) => ({ error: String(e?.message ?? e) }));
    revalidatePublicSite();
    console.log(`[iCal Cron] Finished. Sources: ${result.totalSources}, Success: ${result.successCount}, Blocks added: ${result.totalBlocks}`);

    return NextResponse.json({
      message: 'iCal sync completed successfully',
      ...result,
      calendars,
      outbox
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

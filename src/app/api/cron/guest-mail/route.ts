import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cronAuth';
import { deliverGuestMail } from '@/lib/cala/guest-mail';
import { deliverPush } from '@/lib/cala/push';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Scheduled guest e-mails (CALA → Plantillas de mensajes) only, kept apart
 * from the calendar sync so an external cron (cron-job.org, 30 s limit) gets
 * a quick answer. Each e-mail is sent once: the database claims it first.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const guestMail = await deliverGuestMail({ max: 10 });
    // Browser notifications from events no CALA user triggered (website, Stripe, OTA mail, calendars).
    const push = await deliverPush({ max: 100 }).catch(error => ({ error: String(error) }));
    return NextResponse.json({ guestMail, push });
  } catch (error) {
    console.error('[Cron] Guest mail failed', error);
    return NextResponse.json({ error: 'Guest mail failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

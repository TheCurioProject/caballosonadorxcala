import { NextResponse, after } from 'next/server';
import { isCronAuthorized } from '@/lib/cronAuth';
import { reconcilePendingCheckouts } from '@/lib/checkoutHolds.server';
import { deliverPushQuietly } from '@/lib/cala/push';

export const dynamic = 'force-dynamic';

/**
 * Runs every 5 minutes, but only looks at website checkouts older than the
 * hold (35 min = Stripe's 30-minute session + margin). Each one is checked
 * against Stripe before anything changes: paid → registered in CALA, still
 * open → kept, expired/unpaid → EXPIRED (CALA cancels it and frees the dates).
 * Nothing is deleted; expired checkouts stay as history.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const result = await reconcilePendingCheckouts();
    // A paid stay registered here (its webhook never came) rings the CALA bell on phones right away.
    if (result.registered) after(deliverPushQuietly);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Cron] Expiration failed', error);
    return NextResponse.json({ error: 'Expiration failed' }, { status: 500 });
  }
}

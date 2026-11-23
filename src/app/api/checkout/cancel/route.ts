import { NextResponse } from 'next/server';
import { parseHoldToken, releaseCheckout } from '@/lib/checkoutHolds.server';

export const dynamic = 'force-dynamic';

/**
 * Stripe's "back" link. Frees the dates held by this checkout immediately
 * (instead of after 35 minutes) so the guest can change something and pay
 * again without being blocked by their own unfinished checkout.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const to = url.searchParams.get('to') || '';
  const back = /^\/(es|en)(\/[a-z0-9-]+)*\/?$/.test(to) ? to : '/es/';
  const hold = parseHoldToken(url.searchParams.get('t'));
  if (hold) {
    try {
      await releaseCheckout(hold.kind, hold.id);
    } catch (error) {
      // The cron settles it later; the guest is never stuck on this page.
      console.error('[Checkout cancel] Could not release the hold', hold, error);
    }
  }
  const target = new URL(back, url.origin);
  target.searchParams.set('canceled', 'true');
  return NextResponse.redirect(target, 303);
}

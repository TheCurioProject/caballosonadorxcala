export const dynamic = 'force-dynamic';
import { NextResponse, after } from 'next/server';
import { deliverPushQuietly } from '@/lib/cala/push';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { expireSessionRecords, fulfillPaidSession } from '@/lib/stripeFulfillment.server';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new NextResponse('Missing stripe signature', { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Webhook] CRITICAL: STRIPE_WEBHOOK_SECRET is not configured');
    return new NextResponse('Webhook secret not configured', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    await expireSessionRecords(session.id);
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    // Same code path as the pending-checkout cron, which reconciles paid sessions whose webhook never arrived.
    const result = await fulfillPaidSession(event.data.object as Stripe.Checkout.Session, event.id);
    after(deliverPushQuietly);
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.json({ received: true });
}

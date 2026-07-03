export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
// import Stripe from 'stripe';
import prisma from '@/lib/prisma';

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2023-10-16',
// });

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new NextResponse('Missing stripe signature', { status: 400 });
  }

  try {
    // const event = stripe.webhooks.constructEvent(
    //   body,
    //   signature,
    //   process.env.STRIPE_WEBHOOK_SECRET!
    // );
    
    // Simulate event parsing for skeleton
    const event = JSON.parse(body);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // const bookingId = session.metadata?.bookingId;
      // if (bookingId) {
      //   await prisma.booking.update({
      //     where: { id: parseInt(bookingId) },
      //     data: { payment_status: 'PAID' }
      //   });
      // }
      
      console.log('Payment successful for session:', session.id);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return new NextResponse('Webhook Error', { status: 400 });
  }
}

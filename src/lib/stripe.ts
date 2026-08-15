import Stripe from 'stripe';

// Lazy singleton — instance is created on first access, not at module load time.
// This allows Next.js builds to succeed without STRIPE_SECRET_KEY set.
let _stripe: Stripe | null = null;

function getStripeInstance(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key && process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: STRIPE_SECRET_KEY environment variable is not set in production');
    }
    _stripe = new Stripe(key || 'sk_test_placeholder_for_build', {
      apiVersion: '2025-02-24.acacia' as any,
      typescript: true,
    });
  }
  return _stripe;
}

// Export a proxy object that lazily initializes on first property access
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripeInstance() as any)[prop];
  }
});

export async function createCoupon(name: string, amountOff: number | null, percentOff: number | null, duration: Stripe.CouponCreateParams.Duration = 'once') {
  try {
    const params: Stripe.CouponCreateParams = {
      name,
      duration,
    };
    if (amountOff) {
      params.amount_off = amountOff * 100; // Stripe expects cents/smallest currency unit
      params.currency = 'mxn';
    } else if (percentOff) {
      params.percent_off = percentOff;
    }
    
    return await stripe.coupons.create(params);
  } catch (error) {
    console.error('Error creating Stripe coupon:', error);
    throw error;
  }
}

export async function listCoupons() {
  try {
    const coupons = await stripe.coupons.list({ limit: 100 });
    return coupons.data;
  } catch (error) {
    console.error('Error listing Stripe coupons:', error);
    return [];
  }
}

export async function deleteCoupon(id: string) {
  try {
    return await stripe.coupons.del(id);
  } catch (error) {
    console.error('Error deleting Stripe coupon:', error);
    throw error;
  }
}

export async function getRecentPayments() {
  try {
    // List recent charges or payment intents
    const charges = await stripe.charges.list({ limit: 10 });
    return charges.data;
  } catch (error) {
    console.error('Error listing Stripe payments:', error);
    return [];
  }
}

export async function getAccountBalance() {
  try {
    const balance = await stripe.balance.retrieve();
    return balance;
  } catch (error) {
    console.error('Error retrieving Stripe balance:', error);
    return null;
  }
}

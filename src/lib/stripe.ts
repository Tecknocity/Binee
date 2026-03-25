import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

// Price ID lookup map
const PRICE_MAP: Record<string, Record<string, string>> = {
  monthly: {
    '50':   process.env.STRIPE_PRICE_MO_50!,
    '100':  process.env.STRIPE_PRICE_MO_100!,
    '250':  process.env.STRIPE_PRICE_MO_250!,
    '500':  process.env.STRIPE_PRICE_MO_500!,
    '1000': process.env.STRIPE_PRICE_MO_1000!,
  },
  annual: {
    '50':   process.env.STRIPE_PRICE_YR_50!,
    '100':  process.env.STRIPE_PRICE_YR_100!,
    '250':  process.env.STRIPE_PRICE_YR_250!,
    '500':  process.env.STRIPE_PRICE_YR_500!,
    '1000': process.env.STRIPE_PRICE_YR_1000!,
  },
};

export function getStripePriceId(tier: string, period: string): string {
  const priceId = PRICE_MAP[period]?.[tier];
  if (!priceId) throw new Error(`No price for tier ${tier} / period ${period}`);
  return priceId;
}

// Subscription checkout
export async function createSubscriptionCheckout(
  userId: string,
  tier: string,
  billingPeriod: string,
  customerEmail?: string
) {
  const priceId = getStripePriceId(tier, billingPeriod);

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing`,
    customer_email: customerEmail,
    metadata: {
      userId,
      type: 'subscription',
      tier,
      billingPeriod,
    },
  });
}

// PAYG checkout
export async function createPaygCheckout(
  userId: string,
  creditAmount: number,
  customerEmail?: string
) {
  const PAYGO_PRICE_PER_CREDIT_CENTS = 14;

  return stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${creditAmount} Binee Credits`,
          description: 'One-time credit purchase. Credits never expire.',
        },
        unit_amount: PAYGO_PRICE_PER_CREDIT_CENTS,
      },
      quantity: creditAmount,
    }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing&credits=purchased`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing`,
    customer_email: customerEmail,
    metadata: {
      userId,
      type: 'paygo',
      credits: creditAmount.toString(),
    },
  });
}

// Setup fee checkout
export async function createSetupCheckout(userId: string, customerEmail?: string) {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: process.env.STRIPE_SETUP_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing&setup=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing`,
    metadata: { userId, type: 'setup' },
    customer_email: customerEmail,
  });
}

// Customer Portal
export async function createPortalSession(stripeCustomerId: string) {
  return stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing`,
  });
}

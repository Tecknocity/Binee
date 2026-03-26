import Stripe from 'stripe';

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
    });
  }
  return _stripe;
}

/** @deprecated Use getStripe() instead. Kept for backward compatibility. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Subscription price ID lookup (7 tiers × 2 billing periods = 14 prices)
function getSubscriptionPriceMap(): Record<string, Record<string, string>> {
  return {
    monthly: {
      '100':  process.env.STRIPE_PRICE_MO_100!,
      '150':  process.env.STRIPE_PRICE_MO_150!,
      '250':  process.env.STRIPE_PRICE_MO_250!,
      '500':  process.env.STRIPE_PRICE_MO_500!,
      '750':  process.env.STRIPE_PRICE_MO_750!,
      '1000': process.env.STRIPE_PRICE_MO_1000!,
      '2000': process.env.STRIPE_PRICE_MO_2000!,
    },
    annual: {
      '100':  process.env.STRIPE_PRICE_YR_100!,
      '150':  process.env.STRIPE_PRICE_YR_150!,
      '250':  process.env.STRIPE_PRICE_YR_250!,
      '500':  process.env.STRIPE_PRICE_YR_500!,
      '750':  process.env.STRIPE_PRICE_YR_750!,
      '1000': process.env.STRIPE_PRICE_YR_1000!,
      '2000': process.env.STRIPE_PRICE_YR_2000!,
    },
  };
}

// PAYG one-time price ID lookup (7 packages)
function getPaygPriceMap(): Record<string, string> {
  return {
    '100':  process.env.STRIPE_PRICE_PAYG_100!,
    '150':  process.env.STRIPE_PRICE_PAYG_150!,
    '250':  process.env.STRIPE_PRICE_PAYG_250!,
    '500':  process.env.STRIPE_PRICE_PAYG_500!,
    '750':  process.env.STRIPE_PRICE_PAYG_750!,
    '1000': process.env.STRIPE_PRICE_PAYG_1000!,
    '2000': process.env.STRIPE_PRICE_PAYG_2000!,
  };
}

export function getStripePriceId(tier: string, period: string): string {
  const priceId = getSubscriptionPriceMap()[period]?.[tier];
  if (!priceId) throw new Error(`No price for tier ${tier} / period ${period}`);
  return priceId;
}

export function getPaygPriceId(credits: string): string {
  const priceId = getPaygPriceMap()[credits];
  if (!priceId) throw new Error(`No PAYG price for ${credits} credits`);
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

  return getStripe().checkout.sessions.create({
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

// PAYG checkout (one-time credit package purchase)
export async function createPaygCheckout(
  userId: string,
  creditAmount: number,
  customerEmail?: string
) {
  const priceId = getPaygPriceId(creditAmount.toString());

  return getStripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
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
  return getStripe().checkout.sessions.create({
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
  return getStripe().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing`,
  });
}

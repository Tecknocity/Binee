import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/api-auth';
import { createSubscriptionCheckout } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PLAN_TIERS } from '@/billing/config';

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tier, billingPeriod } = await req.json();

  if (!tier || !billingPeriod) {
    return NextResponse.json({ error: 'tier and billingPeriod are required' }, { status: 400 });
  }

  if (!(tier in PLAN_TIERS)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  if (!['monthly', 'annual'].includes(billingPeriod)) {
    return NextResponse.json({ error: 'Invalid billingPeriod' }, { status: 400 });
  }

  // Get user email for Stripe
  const { data: user } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = user?.user?.email;

  const session = await createSubscriptionCheckout(userId, tier, billingPeriod, email);

  return NextResponse.json({ url: session.url });
}

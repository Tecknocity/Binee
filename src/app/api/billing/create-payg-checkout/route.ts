import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/api-auth';
import { createPaygCheckout } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PAYGO_MIN_PURCHASE_CENTS, PAYGO_PRICE_PER_CREDIT_CENTS } from '@/billing/config';

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { credits } = await req.json();

  if (!credits || typeof credits !== 'number' || credits < 1) {
    return NextResponse.json({ error: 'credits must be a positive number' }, { status: 400 });
  }

  const totalCents = credits * PAYGO_PRICE_PER_CREDIT_CENTS;
  if (totalCents < PAYGO_MIN_PURCHASE_CENTS) {
    const minCredits = Math.ceil(PAYGO_MIN_PURCHASE_CENTS / PAYGO_PRICE_PER_CREDIT_CENTS);
    return NextResponse.json(
      { error: `Minimum purchase is ${minCredits} credits ($${(PAYGO_MIN_PURCHASE_CENTS / 100).toFixed(2)})` },
      { status: 400 },
    );
  }

  // Get user email for Stripe
  const { data: user } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = user?.user?.email;

  const session = await createPaygCheckout(userId, credits, email);

  return NextResponse.json({ url: session.url });
}

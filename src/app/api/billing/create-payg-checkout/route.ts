import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/api-auth';
import { createPaygCheckout } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PLAN_TIERS } from '@/billing/config';

// Valid PAYG amounts match the subscription tier credit amounts
const VALID_PAYG_AMOUNTS = new Set(
  Object.values(PLAN_TIERS).map((t) => t.credits)
);

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { credits } = await req.json();

  if (!credits || typeof credits !== 'number' || !VALID_PAYG_AMOUNTS.has(credits)) {
    return NextResponse.json(
      { error: `Invalid credit amount. Valid options: ${[...VALID_PAYG_AMOUNTS].join(', ')}` },
      { status: 400 },
    );
  }

  // Get user email for Stripe
  const { data: user } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = user?.user?.email;

  const session = await createPaygCheckout(userId, credits, email);

  return NextResponse.json({ url: session.url });
}

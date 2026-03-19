import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { grantSubscriptionCredits } from '@/lib/credits/grants';

// B-020: Stripe webhook endpoint for subscription events
// Full Stripe signature verification will be added in B-090
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // TODO (B-090): Verify Stripe webhook signature
  const stripeSignature = request.headers.get('stripe-signature');
  if (!stripeSignature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event;
  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Handle subscription renewal events
  if (event.type === 'invoice.payment_succeeded') {
    const subscription = event.data?.object;
    const workspaceId = subscription?.metadata?.workspace_id;
    const userId = subscription?.metadata?.user_id;

    if (!workspaceId || !userId) {
      return NextResponse.json({ error: 'Missing workspace_id or user_id in metadata' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const result = await grantSubscriptionCredits(workspaceId, userId, { supabase });

    if (!result.success) {
      console.error('Credit grant failed:', result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      received: true,
      credits_granted: result.credits_granted,
    });
  }

  // Acknowledge other event types
  return NextResponse.json({ received: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/api-auth';
import { createSetupCheckout } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user email for Stripe
  const { data: user } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = user?.user?.email;

  const session = await createSetupCheckout(userId, email);

  return NextResponse.json({ url: session.url });
}

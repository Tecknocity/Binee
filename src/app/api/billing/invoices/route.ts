import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/api-auth';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user's Stripe customer ID
  const { data: sub } = await supabaseAdmin
    .from('user_subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ invoices: [] });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);

  const invoices = await stripe.invoices.list({
    customer: sub.stripe_customer_id,
    limit,
  });

  const formatted = invoices.data.map((inv) => ({
    id: inv.id,
    number: inv.number,
    status: inv.status,
    amountPaid: inv.amount_paid,
    currency: inv.currency,
    created: inv.created,
    periodStart: inv.period_start,
    periodEnd: inv.period_end,
    invoicePdfUrl: inv.invoice_pdf,
    hostedInvoiceUrl: inv.hosted_invoice_url,
  }));

  return NextResponse.json({ invoices: formatted });
}

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { allocateMonthlyCredits } from '@/billing/lifecycle/renewal';
import { processExpiredSubscription } from '@/billing/lifecycle/cancellation';
import { handlePaymentFailure } from '@/billing/lifecycle/payment-failure';
import { handleSetupPurchase } from '@/billing/lifecycle/setup-purchase';
import { createClient } from '@supabase/supabase-js';
import { CREDIT_ALLOCATION_INTERVAL_DAYS } from '@/billing/config';
import type { PlanTier } from '@/billing/types/subscriptions';

// B-093: Full Stripe webhook handler (replaces old B-020 stub)
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {

      // ============================================
      // NEW SUBSCRIPTION OR ONE-TIME PURCHASE
      // ============================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, type, tier, billingPeriod, credits } = session.metadata || {};

        if (type === 'subscription' && tier && billingPeriod) {
          const now = new Date();
          const nextAllocation = new Date();
          nextAllocation.setDate(nextAllocation.getDate() + CREDIT_ALLOCATION_INTERVAL_DAYS);

          // Calculate annual_end_date for annual plans
          const annualEndDate = billingPeriod === 'annual'
            ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()
            : null;

          // Create/update subscription record
          await supabaseAdmin
            .from('user_subscriptions')
            .update({
              status: 'active',
              plan_tier: tier,
              billing_period: billingPeriod,
              current_period_start: now.toISOString(),
              current_period_end: billingPeriod === 'annual'
                ? annualEndDate
                : nextAllocation.toISOString(),
              next_credit_allocation_date: now.toISOString(), // Allocate now
              annual_end_date: annualEndDate,
              stripe_customer_id: session.customer as string,
              payment_provider_id: session.subscription as string,
              cancel_at_period_end: false,
              pending_plan_change: null,
              updated_at: now.toISOString(),
            })
            .eq('user_id', userId);

          // Grant first month's credits immediately
          await allocateMonthlyCredits(userId!, tier as PlanTier);

        } else if (type === 'paygo' && credits) {
          // PAYG one-time purchase
          const creditCount = parseInt(credits);
          await supabaseAdmin.rpc('add_paygo_credits', {
            p_user_id: userId,
            p_credits: creditCount,
          });

        } else if (type === 'setup') {
          await handleSetupPurchase(userId!);
        }
        break;
      }

      // ============================================
      // RECURRING PAYMENT (monthly charge or annual renewal)
      // ============================================
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;

        // Skip the first invoice (already handled by checkout.session.completed)
        if (invoice.billing_reason === 'subscription_create') break;

        const stripeCustomerId = invoice.customer as string;

        // Look up user by stripe_customer_id
        const { data: sub } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id, plan_tier, billing_period')
          .eq('stripe_customer_id', stripeCustomerId)
          .single();

        if (!sub) break;

        if (sub.billing_period === 'monthly') {
          // ---- MONTHLY: Grant credits on every invoice ----
          await allocateMonthlyCredits(sub.user_id, sub.plan_tier as any);

        } else if (sub.billing_period === 'annual') {
          // ---- ANNUAL: Stripe only charges once/year ----
          // Don't grant 12 months of credits at once!
          // Just extend the annual_end_date for another 12 months.
          // The daily cron (B-092) handles monthly credit drips.
          const newAnnualEnd = new Date();
          newAnnualEnd.setFullYear(newAnnualEnd.getFullYear() + 1);

          await supabaseAdmin
            .from('user_subscriptions')
            .update({
              annual_end_date: newAnnualEnd.toISOString(),
              current_period_start: new Date().toISOString(),
              current_period_end: newAnnualEnd.toISOString(),
              status: 'active',  // In case it was past_due
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', sub.user_id);
        }
        break;
      }

      // ============================================
      // SUBSCRIPTION CHANGED (tier or billing period)
      // ============================================
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = subscription.customer as string;

        const { data: sub } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id, plan_tier, billing_period')
          .eq('stripe_customer_id', stripeCustomerId)
          .single();

        if (!sub) break;

        // Detect tier change from Stripe's price ID
        // Compare previous vs new to determine upgrade/downgrade
        // If upgrade: handleUpgrade(sub.user_id, oldTier, newTier)
        // If downgrade: handleDowngrade(sub.user_id, newTier)
        break;
      }

      // ============================================
      // SUBSCRIPTION CANCELLED/EXPIRED
      // ============================================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = subscription.customer as string;

        const { data: sub } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', stripeCustomerId)
          .single();

        if (sub) {
          await processExpiredSubscription(sub.user_id);
        }
        break;
      }

      // ============================================
      // PAYMENT FAILED
      // ============================================
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = invoice.customer as string;

        const { data: sub } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', stripeCustomerId)
          .single();

        if (sub) {
          await handlePaymentFailure(sub.user_id);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

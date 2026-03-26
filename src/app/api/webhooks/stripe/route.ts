import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { processExpiredSubscription } from '@/billing/lifecycle/cancellation';
import { handlePaymentFailure } from '@/billing/lifecycle/payment-failure';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PLAN_TIERS, CREDIT_ALLOCATION_INTERVAL_DAYS } from '@/billing/config';
import type { PlanTier } from '@/billing/types/subscriptions';

// ---------------------------------------------------------------------------
// Helper: add credits to the workspace owned by a given user
// ---------------------------------------------------------------------------
async function addCreditsToWorkspace(userId: string, credits: number, description: string) {
  // Find workspace owned by this user
  const { data: ws } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .single();

  if (!ws) {
    console.error(`[stripe-webhook] No workspace found for owner ${userId}`);
    return;
  }

  // Atomic credit addition via RPC
  await supabaseAdmin.rpc('add_credits', {
    p_workspace_id: ws.id,
    p_user_id: userId,
    p_amount: credits,
    p_type: 'subscription',
    p_description: description,
    p_metadata: {},
  });
}

// B-093: Full Stripe webhook handler (replaces old B-020 stub)
export const dynamic = 'force-dynamic';

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

          // Create/update subscription record (keep for plan metadata)
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
              next_credit_allocation_date: now.toISOString(),
              annual_end_date: annualEndDate,
              stripe_customer_id: session.customer as string,
              payment_provider_id: session.subscription as string,
              cancel_at_period_end: false,
              pending_plan_change: null,
              updated_at: now.toISOString(),
            })
            .eq('user_id', userId);

          // Grant first month's credits to WORKSPACE pool
          const tierConfig = PLAN_TIERS[tier as PlanTier];
          if (tierConfig) {
            await addCreditsToWorkspace(
              userId!,
              tierConfig.credits,
              `Subscription activated: ${tierConfig.credits} credits (${tier} plan)`,
            );
          }

        } else if (type === 'paygo' && credits) {
          // PAYG one-time purchase — add to workspace pool
          const creditCount = parseInt(credits);
          await addCreditsToWorkspace(
            userId!,
            creditCount,
            `PAYG purchase: ${creditCount} credits`,
          );

        } else if (type === 'setup') {
          // Setup fee — add setup credits to workspace pool
          const { SETUP_CREDITS } = await import('@/billing/config');
          await addCreditsToWorkspace(
            userId!,
            SETUP_CREDITS,
            `Workspace setup purchase: ${SETUP_CREDITS} credits`,
          );
        }
        break;
      }

      // ============================================
      // RECURRING PAYMENT (monthly charge or annual renewal)
      // ============================================
      case 'invoice.payment_succeeded': {
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
          // ---- MONTHLY: Grant credits to workspace on every invoice ----
          const tierConfig = PLAN_TIERS[sub.plan_tier as PlanTier];
          if (tierConfig) {
            await addCreditsToWorkspace(
              sub.user_id,
              tierConfig.credits,
              `Monthly renewal: ${tierConfig.credits} credits (${sub.plan_tier} plan)`,
            );
          }

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

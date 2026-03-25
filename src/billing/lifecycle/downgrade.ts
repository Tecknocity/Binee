import { supabaseAdmin } from '@/lib/supabase-admin';
import type { PlanTier } from '../types/subscriptions';

/**
 * Handle plan downgrade — takes effect on next allocation only.
 *
 * User keeps their current credits for the remainder of the cycle.
 * The pending_plan_change is applied during the next allocateMonthlyCredits() call.
 */
export async function handleDowngrade(userId: string, newTier: PlanTier) {
  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      pending_plan_change: newTier,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to schedule downgrade: ${error.message}`);
}

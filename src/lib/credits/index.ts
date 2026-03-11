import { createBrowserClient } from '@/lib/supabase/client';
import type { CreditTransaction, DeductCreditsResult } from '@/types/database';

// Plan credit allocations
export const PLAN_CREDITS: Record<string, number> = {
  free: 10,
  starter: 200,
  pro: 600,
};

// Plan limits
export const PLAN_LIMITS: Record<string, { maxMembers: number | null; maxDashboards: number | null; canSetup: boolean }> = {
  free: { maxMembers: 1, maxDashboards: 1, canSetup: false },
  starter: { maxMembers: 5, maxDashboards: 5, canSetup: true },
  pro: { maxMembers: null, maxDashboards: null, canSetup: true },
};

export async function deductCredits(
  workspaceId: string,
  userId: string,
  amount: number,
  description: string,
  metadata: Record<string, unknown> = {},
): Promise<DeductCreditsResult> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.rpc('deduct_credits', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_metadata: metadata,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as DeductCreditsResult;
}

export async function addCredits(
  workspaceId: string,
  userId: string,
  amount: number,
  type: 'purchase' | 'bonus' | 'refund' | 'monthly_reset',
  description: string,
  metadata: Record<string, unknown> = {},
): Promise<{ success: boolean; error?: string }> {
  const supabase = createBrowserClient();

  // Get current balance
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('credit_balance')
    .eq('id', workspaceId)
    .single();

  if (wsError || !workspace) {
    return { success: false, error: wsError?.message || 'Workspace not found' };
  }

  const newBalance = workspace.credit_balance + amount;

  // Update balance
  const { error: updateError } = await supabase
    .from('workspaces')
    .update({ credit_balance: newBalance })
    .eq('id', workspaceId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Record transaction
  const { error: txError } = await supabase.from('credit_transactions').insert({
    workspace_id: workspaceId,
    user_id: userId,
    amount,
    balance_after: newBalance,
    type,
    description,
    metadata,
  });

  if (txError) {
    return { success: false, error: txError.message };
  }

  return { success: true };
}

export async function getCreditBalance(workspaceId: string): Promise<number> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase
    .from('workspaces')
    .select('credit_balance')
    .eq('id', workspaceId)
    .single();

  if (error || !data) return 0;
  return data.credit_balance;
}

export async function getCreditHistory(
  workspaceId: string,
  limit = 50,
): Promise<CreditTransaction[]> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as CreditTransaction[];
}

export async function checkPlanLimit(
  workspaceId: string,
  feature: 'members' | 'dashboards' | 'setup',
): Promise<{ allowed: boolean; reason?: string }> {
  const supabase = createBrowserClient();

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('plan')
    .eq('id', workspaceId)
    .single();

  if (!workspace) return { allowed: false, reason: 'Workspace not found' };

  const limits = PLAN_LIMITS[workspace.plan] ?? PLAN_LIMITS.free;

  if (feature === 'setup' && !limits.canSetup) {
    return { allowed: false, reason: 'AI workspace setup requires the Starter plan or higher.' };
  }

  if (feature === 'members' && limits.maxMembers !== null) {
    const { count } = await supabase
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if ((count ?? 0) >= limits.maxMembers) {
      return { allowed: false, reason: `Your ${workspace.plan} plan allows up to ${limits.maxMembers} members. Upgrade to add more.` };
    }
  }

  if (feature === 'dashboards' && limits.maxDashboards !== null) {
    const { count } = await supabase
      .from('dashboards')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if ((count ?? 0) >= limits.maxDashboards) {
      return { allowed: false, reason: `Your ${workspace.plan} plan allows up to ${limits.maxDashboards} dashboards. Upgrade for more.` };
    }
  }

  return { allowed: true };
}

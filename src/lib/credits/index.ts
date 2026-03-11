import { createAdminClient } from '@/lib/supabase/client';
import type { CreditTransaction, DeductCreditsResult } from '@/types/database';

export async function deductCredits(
  workspaceId: string,
  userId: string,
  amount: number,
  description: string,
  metadata: Record<string, unknown> = {}
): Promise<DeductCreditsResult> {
  const supabase = createAdminClient();

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
  metadata: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

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
  const supabase = createAdminClient();

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
  limit = 50
): Promise<CreditTransaction[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as CreditTransaction[];
}

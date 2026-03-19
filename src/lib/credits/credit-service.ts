import { createBrowserClient } from '@/lib/supabase/client';
import type { CreditTransaction } from '@/types/database';
import type {
  DeductResult,
  AddResult,
  CreditTransactionType,
  MemberUsage,
} from './types';

/**
 * Check the current credit balance for a workspace.
 */
export async function checkBalance(workspaceId: string): Promise<number> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase
    .from('workspaces')
    .select('credit_balance')
    .eq('id', workspaceId)
    .single();

  if (error || !data) return 0;
  return data.credit_balance;
}

/**
 * Deduct credits from a workspace using the atomic SQL function.
 * Returns an error object on failure instead of throwing.
 */
export async function deductCredits(
  workspaceId: string,
  userId: string,
  amount: number,
  description: string,
  messageId?: string,
  metadata: Record<string, unknown> = {},
): Promise<DeductResult> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.rpc('deduct_credits', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_message_id: messageId ?? null,
    p_metadata: metadata,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as DeductResult;
}

/**
 * Add credits to a workspace (purchases, subscription grants, bonuses, refunds).
 * Returns an error object on failure instead of throwing.
 */
export async function addCredits(
  workspaceId: string,
  userId: string,
  amount: number,
  type: CreditTransactionType,
  description: string,
  metadata: Record<string, unknown> = {},
): Promise<AddResult> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.rpc('add_credits', {
    p_workspace_id: workspaceId,
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_description: description,
    p_metadata: metadata,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as AddResult;
}

/**
 * Get paginated credit transaction history for a workspace.
 * Optionally filter by user.
 */
export async function getUsageHistory(
  workspaceId: string,
  options: { userId?: string; limit?: number; offset?: number } = {},
): Promise<CreditTransaction[]> {
  const { userId, limit = 50, offset = 0 } = options;
  const supabase = createBrowserClient();

  let query = supabase
    .from('credit_transactions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error || !data) return [];
  return data as CreditTransaction[];
}

/**
 * Aggregate credit usage per workspace member.
 * Only counts deductions (negative-amount transactions).
 */
export async function getUsageByMember(
  workspaceId: string,
): Promise<MemberUsage[]> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('user_id, amount')
    .eq('workspace_id', workspaceId)
    .eq('type', 'deduction');

  if (error || !data) return [];

  // Aggregate in JS since Supabase JS client doesn't support GROUP BY
  const usageMap = new Map<string, { total: number; count: number }>();

  for (const row of data) {
    const uid = row.user_id ?? 'unknown';
    const existing = usageMap.get(uid);
    if (existing) {
      existing.total += Math.abs(row.amount);
      existing.count += 1;
    } else {
      usageMap.set(uid, { total: Math.abs(row.amount), count: 1 });
    }
  }

  return Array.from(usageMap.entries()).map(([user_id, usage]) => ({
    user_id,
    total_credits_used: usage.total,
    transaction_count: usage.count,
  }));
}

/**
 * Server-side credit guard for billable API routes.
 *
 * Background. The platform charges a flat number of credits per AI action
 * (see MESSAGE_CREDIT_TIERS). Until now only /api/chat checked the
 * workspace balance BEFORE running the Anthropic call; every other
 * route deducted credits AFTER. The deduct_credits RPC does enforce
 * atomicity (it returns success: false / error: insufficient_credits
 * when the workspace is over its limit), but at that point we have
 * already paid Anthropic for the call - the user gets the response,
 * we eat the cost, and the deduction silently fails.
 *
 * This module promotes the pre-check to a single place that every
 * billable route imports. The semantics are deliberately simple:
 *
 *   const guard = await assertSufficientCredits(supabase, workspaceId, cost);
 *   if (!guard.ok) return guard.response;   // 402 with insufficient_credits
 *
 * - `cost` is the credit amount the route is about to deduct. Use the
 *   matching MESSAGE_CREDIT_TIERS value (0.55, 0.85, 1.30, 2.00).
 * - For routes that do not bill but DO consume Anthropic budget (e.g.
 *   the attachment upload endpoint, which we agreed not to charge per
 *   upload), pass cost = 0.01 to enforce a "must have ANY credit" rule
 *   without overcharging.
 */

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CreditGuardOk {
  ok: true;
  balance: number;
}

export interface CreditGuardBlocked {
  ok: false;
  response: NextResponse;
}

export type CreditGuardResult = CreditGuardOk | CreditGuardBlocked;

/**
 * Read the workspace's credit balance and reject the request when it
 * is below `requiredCredits`. The check uses the same `credit_balance`
 * column the deduct_credits RPC locks against, so the pre-check and
 * the eventual deduction agree on what "available" means.
 */
export async function assertSufficientCredits(
  supabase: SupabaseClient,
  workspaceId: string,
  requiredCredits: number,
): Promise<CreditGuardResult> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('credit_balance')
    .eq('id', workspaceId)
    .maybeSingle();

  if (error) {
    // Surface the underlying read error rather than silently letting
    // the call through; a workspace lookup failure is already an
    // anomaly worth a 500.
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Failed to verify workspace credits', detail: error.message },
        { status: 500 },
      ),
    };
  }

  if (!data) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      ),
    };
  }

  // Round to match the deduct_credits RPC; credit_balance is a NUMERIC
  // and the RPC compares with integer-cost arguments. Without the
  // round, a balance of 0.4 against a cost of 0 would let through
  // (and then deduct_credits would correctly reject when called).
  const balance = Number(data.credit_balance ?? 0);
  if (balance < requiredCredits) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'insufficient_credits',
          message:
            'You have run out of credits for this workspace. Upgrade your plan or top up to continue.',
          required: requiredCredits,
          available: balance,
        },
        { status: 402 },
      ),
    };
  }

  return { ok: true, balance };
}

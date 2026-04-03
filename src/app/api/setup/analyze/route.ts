import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { executeSubAgent } from '@/lib/ai/sub-agents/executor';
import { syncWorkspaceStructure } from '@/lib/clickup/sync';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';

export const maxDuration = 45; // Extra time for ClickUp sync + AI analysis

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/**
 * POST /api/setup/analyze
 *
 * 1. Syncs fresh workspace structure from ClickUp (spaces, folders, lists)
 * 2. Runs workspace_analyst sub-agent (Haiku) on the fresh data
 * 3. Charges 0.55 credits
 *
 * This endpoint is called every time the user enters the Analysis step,
 * so the data is always current — not stale from a previous sync.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit(`setup-analyze:${user.id}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const { workspace_id } = await request.json();
    if (!workspace_id) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    // Step 1: Sync fresh workspace structure from ClickUp
    // This ensures the analyst sees the current state, not stale cached data.
    let structureCounts = { spaces: 0, folders: 0, lists: 0 };
    try {
      structureCounts = await syncWorkspaceStructure(workspace_id);
    } catch (syncErr) {
      console.error('[setup/analyze] Structure sync failed:', syncErr);
      // Continue with cached data — better than blocking entirely
    }

    // Step 2: Run workspace_analyst sub-agent on the (now fresh) cached data
    const result = await executeSubAgent(
      getClient(),
      'workspace_analyst',
      'Provide a complete snapshot of the current workspace structure: all spaces, folders, lists, statuses, custom fields, and team members. Include counts for each. If the workspace is empty, say so clearly.',
      workspace_id,
    );

    // Step 3: Charge credits (simple tier = 0.55 credits)
    const creditsToCharge = 0.55;
    try {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      await adminClient.rpc('deduct_credits', {
        p_workspace_id: workspace_id,
        p_user_id: user.id,
        p_amount: creditsToCharge,
        p_description: 'Setup: workspace analysis',
        p_message_id: null,
        p_metadata: {
          credit_tier: 'simple',
          source: 'setup_analysis',
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          structure_synced: structureCounts,
        },
      });

      await adminClient.from('credit_usage').insert({
        user_id: user.id,
        workspace_id,
        action_type: 'chat',
        session_id: `setup-analysis-${Date.now()}`,
        model_used: 'haiku',
        input_tokens: result.inputTokens ?? 0,
        output_tokens: result.outputTokens ?? 0,
        anthropic_cost_cents: 0,
        credits_deducted: creditsToCharge,
      });
    } catch (creditErr) {
      console.error('[setup/analyze] Credit deduction failed:', creditErr);
    }

    return NextResponse.json({
      summary: result.summary,
      error: result.error || null,
      credits_consumed: creditsToCharge,
      structure: structureCounts,
    });
  } catch (error) {
    console.error('[POST /api/setup/analyze] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 },
    );
  }
}

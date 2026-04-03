import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { executeSubAgent } from '@/lib/ai/sub-agents/executor';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';
export const maxDuration = 30;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/**
 * POST /api/setup/analyze
 *
 * Fires the workspace_analyst sub-agent (Haiku) to scan the current
 * ClickUp workspace structure. Called at setup Step 1 (Analysis).
 *
 * Charges 0.55 credits (simple tier — one sub-agent call).
 * Returns the analysis summary string for the analysis UI and planner prompt.
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

    const result = await executeSubAgent(
      getClient(),
      'workspace_analyst',
      'Provide a complete snapshot of the current workspace structure: all spaces, folders, lists, statuses, custom fields, and team members. Include counts for each. If the workspace is empty, say so clearly.',
      workspace_id,
    );

    // Charge credits for the analysis (simple tier = 0.55 credits)
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
        },
      });

      // Log to credit_usage
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
      // Don't block the analysis — credit failures are non-fatal
    }

    return NextResponse.json({
      summary: result.summary,
      error: result.error || null,
      credits_consumed: creditsToCharge,
    });
  } catch (error) {
    console.error('[POST /api/setup/analyze] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 },
    );
  }
}

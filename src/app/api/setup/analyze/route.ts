import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { executeSubAgent } from '@/lib/ai/sub-agents/executor';
import { syncWorkspaceStructure } from '@/lib/clickup/sync';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';

export const maxDuration = 45;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/**
 * POST /api/setup/analyze
 *
 * 1. Syncs fresh workspace structure from ClickUp (spaces, folders, lists)
 * 2. Reads hard counts directly from Supabase cached tables (reliable)
 * 3. Runs workspace_analyst sub-agent (Haiku) for qualitative analysis
 * 4. Returns both structured counts AND AI summary
 *
 * This way, the UI gets accurate numbers from the DB and uses the AI
 * only for insights/findings — not for counting.
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

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Step 1: Sync fresh workspace structure from ClickUp
    let structureCounts = { spaces: 0, folders: 0, lists: 0 };
    try {
      structureCounts = await syncWorkspaceStructure(workspace_id);
    } catch (syncErr) {
      console.error('[setup/analyze] Structure sync failed:', syncErr);
    }

    // Step 2: Read hard counts from cached Supabase tables (source of truth for numbers)
    const [spacesRes, foldersRes, listsRes, tasksRes, membersRes] = await Promise.all([
      adminClient.from('cached_spaces').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace_id),
      adminClient.from('cached_folders').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace_id),
      adminClient.from('cached_lists').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace_id),
      adminClient.from('cached_tasks').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace_id),
      adminClient.from('cached_members').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace_id),
    ]);

    const counts = {
      spaces: spacesRes.count ?? 0,
      folders: foldersRes.count ?? 0,
      lists: listsRes.count ?? 0,
      tasks: tasksRes.count ?? 0,
      members: membersRes.count ?? 0,
    };

    // Step 3: Run workspace_analyst for qualitative analysis (findings, recommendations)
    const result = await executeSubAgent(
      getClient(),
      'workspace_analyst',
      'Provide a complete snapshot of the current workspace structure: all spaces, folders, lists, statuses, custom fields, and team members. Include counts for each. If the workspace is empty, say so clearly.',
      workspace_id,
    );

    // Step 4: Charge credits (simple tier = 0.55)
    const creditsToCharge = 0.55;
    try {
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
      counts,
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

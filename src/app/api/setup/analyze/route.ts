import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { executeSubAgent } from '@/lib/ai/sub-agents/executor';
import { createServerClient } from '@/lib/supabase/server';
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
 * ClickUp workspace structure. Called once after ClickUp connects,
 * before the Describe step becomes interactive.
 *
 * Returns the analysis summary string for injection into the planner prompt.
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
      'Provide a complete snapshot of the current workspace structure: all spaces, folders, lists, statuses, custom fields, and team members. If the workspace is empty, say so clearly.',
      workspace_id,
    );

    return NextResponse.json({
      summary: result.summary,
      error: result.error || null,
    });
  } catch (error) {
    console.error('[POST /api/setup/analyze] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 },
    );
  }
}

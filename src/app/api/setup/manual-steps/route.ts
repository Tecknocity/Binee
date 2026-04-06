import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const maxDuration = 10;

/**
 * GET /api/setup/manual-steps?workspace_id=xxx
 *
 * Fetch manual step completions for a workspace.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspace_id');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('manual_step_completions')
      .select('step_index, step_title, completed, completed_by, completed_at')
      .eq('workspace_id', workspaceId)
      .order('step_index', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ completions: data || [] });
  } catch (error) {
    console.error('[GET /api/setup/manual-steps] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch manual steps' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/setup/manual-steps
 *
 * Toggle a manual step completion. Upserts on (workspace_id, step_index).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspace_id, step_index, step_title, completed } = await request.json() as {
      workspace_id: string;
      step_index: number;
      step_title: string;
      completed: boolean;
    };

    if (!workspace_id || step_index === undefined || step_index === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase
      .from('manual_step_completions')
      .upsert(
        {
          workspace_id,
          step_index,
          step_title: step_title || '',
          completed,
          completed_by: completed ? user.id : null,
          completed_at: completed ? new Date().toISOString() : null,
        },
        { onConflict: 'workspace_id,step_index' },
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/setup/manual-steps] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update manual step' },
      { status: 500 },
    );
  }
}

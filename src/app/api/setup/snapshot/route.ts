import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { takeWorkspaceSnapshot } from '@/lib/setup/snapshots';
import type { SetupPlan } from '@/lib/setup/types';

export const maxDuration = 30;

/**
 * POST /api/setup/snapshot
 *
 * Takes a snapshot of the current workspace structure before build execution.
 * This is a safety net so we can restore the workspace if anything goes wrong.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspace_id, snapshot_type, setup_plan } = await request.json() as {
      workspace_id: string;
      snapshot_type: 'pre_build' | 'manual';
      setup_plan?: SetupPlan;
    };

    if (!workspace_id) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    const result = await takeWorkspaceSnapshot(
      workspace_id,
      snapshot_type || 'pre_build',
      user.id,
      setup_plan,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/setup/snapshot] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Snapshot failed' },
      { status: 500 },
    );
  }
}

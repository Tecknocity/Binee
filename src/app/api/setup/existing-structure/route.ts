import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getExistingStructure } from '@/lib/setup/snapshots';
import { syncWorkspaceStructure } from '@/lib/clickup/sync';

export const maxDuration = 30;

/**
 * POST /api/setup/existing-structure
 *
 * Returns the current workspace structure. Always refreshes from ClickUp
 * first so the Review stage and pre-build checks see the user's latest
 * ClickUp reality, not a stale snapshot captured at Analyze time.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspace_id } = await request.json();
    if (!workspace_id) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    // Refresh cached_spaces/folders/lists from ClickUp before reading them.
    // If the sync fails (network, rate limit), fall back to cached data so
    // the UI still functions, just with the previous snapshot.
    try {
      await syncWorkspaceStructure(workspace_id);
    } catch (syncErr) {
      console.error('[setup/existing-structure] Sync failed, using cached data:', syncErr);
    }

    // Treat an empty workspace as an explicit empty structure (not null) so
    // the client can reconcile its local "previously built items" against the
    // actual ClickUp state - including the case where the user manually
    // deleted everything.
    const structure = await getExistingStructure(workspace_id) ?? {
      spaces: [],
      captured_at: new Date().toISOString(),
    };
    return NextResponse.json({ structure });
  } catch (error) {
    console.error('[POST /api/setup/existing-structure] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch structure' },
      { status: 500 },
    );
  }
}

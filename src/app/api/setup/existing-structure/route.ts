import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getExistingStructure } from '@/lib/setup/snapshots';

export const maxDuration = 15;

/**
 * POST /api/setup/existing-structure
 *
 * Returns the current workspace structure from cached tables.
 * Used by the Review stage to show what already exists vs what's new.
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

    // For this endpoint, treat an empty workspace as an explicit empty
    // structure (not null) so the client can reconcile its local "previously
    // built items" against the actual ClickUp state - including the case
    // where the user manually deleted everything.
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

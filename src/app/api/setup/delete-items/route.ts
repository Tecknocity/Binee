import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { deleteRemovedItems } from '@/lib/setup/executor';
import type { ExecutionItem } from '@/lib/setup/executor';

export const maxDuration = 60;

/**
 * POST /api/setup/delete-items
 *
 * Deletes items from ClickUp that were created by Binee in a previous build
 * but are no longer needed in the current plan. Only deletes items the user
 * has explicitly confirmed.
 *
 * Body: { workspace_id, items_to_delete: ExecutionItem[] }
 * Response: { results: ExecutionItem[] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, items_to_delete } = body as {
      workspace_id: string;
      items_to_delete: ExecutionItem[];
    };

    if (!workspace_id || !items_to_delete || items_to_delete.length === 0) {
      return NextResponse.json({ error: 'Missing workspace_id or items_to_delete' }, { status: 400 });
    }

    // Verify user belongs to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', authUser.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    const results = await deleteRemovedItems(items_to_delete, workspace_id);

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[setup/delete-items] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

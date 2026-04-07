import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { executeSetupPlan } from '@/lib/setup/executor';
import type { SetupPlan } from '@/lib/setup/types';
import type { ExistingWorkspaceStructure } from '@/stores/setupStore';

export const maxDuration = 120;

/**
 * POST /api/setup/execute
 *
 * Runs the setup execution plan server-side where ClickUp tokens
 * (and SUPABASE_SERVICE_ROLE_KEY) are accessible.
 *
 * Body: { workspace_id, plan, existing_structure? }
 * Response: { result: ExecutionResult }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, plan, existing_structure } = body as {
      workspace_id: string;
      plan: SetupPlan;
      existing_structure?: ExistingWorkspaceStructure | null;
    };

    if (!workspace_id || !plan) {
      return NextResponse.json({ error: 'Missing workspace_id or plan' }, { status: 400 });
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

    const result = await executeSetupPlan(
      plan,
      workspace_id,
      '', // accessToken param is unused - ClickUpClient fetches its own token server-side
      undefined, // no progress callback needed for non-streaming response
      existing_structure,
    );

    return NextResponse.json({ result });
  } catch (err) {
    console.error('[setup/execute] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

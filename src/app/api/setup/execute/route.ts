import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { executeSetupPlan } from '@/lib/setup/executor';
import { syncWorkspaceStructure } from '@/lib/clickup/sync';
import { getExistingStructure } from '@/lib/setup/snapshots';
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
    const { workspace_id, plan, existing_structure, generate_enrichment } = body as {
      workspace_id: string;
      plan: SetupPlan;
      existing_structure?: ExistingWorkspaceStructure | null;
      generate_enrichment?: boolean;
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

    // Fetch ClickUp plan tier for smart skip and error classification
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: workspaceRow } = await adminClient
      .from('workspaces')
      .select('clickup_plan_tier')
      .eq('id', workspace_id)
      .single();
    const planTier = workspaceRow?.clickup_plan_tier || 'free';

    // Defense-in-depth: refresh ClickUp cache and rebuild existing_structure
    // server-side so the executor operates on current reality, not whatever
    // the client shipped in the request body. Covers the window between
    // Review modal and Build click. Falls back to client-supplied structure
    // if the sync fails.
    let resolvedStructure: ExistingWorkspaceStructure | null | undefined = existing_structure;
    try {
      await syncWorkspaceStructure(workspace_id);
      const fresh = await getExistingStructure(workspace_id);
      if (fresh) {
        resolvedStructure = fresh as ExistingWorkspaceStructure;
      }
    } catch (syncErr) {
      console.error('[setup/execute] Pre-build sync failed, using client-supplied structure:', syncErr);
    }

    let result;
    try {
      result = await executeSetupPlan(
        plan,
        workspace_id,
        '', // accessToken param is unused - ClickUpClient fetches its own token server-side
        undefined, // no progress callback needed for non-streaming response
        resolvedStructure,
        planTier,
        { generateEnrichment: generate_enrichment !== false, userId: authUser.id },
      );
    } catch (execErr) {
      // Log the actual error for debugging
      console.error('[setup/execute] Executor threw:', execErr);

      // Return a minimal result so the frontend can still show partial progress
      // rather than a generic "Internal server error"
      const errorMessage = execErr instanceof Error ? execErr.message : 'Execution failed unexpectedly';
      result = {
        success: false,
        totalItems: 0,
        successCount: 0,
        errorCount: 1,
        items: [],
        createdSpaceIds: [],
        createdFolderIds: [],
        createdListIds: [],
        executorError: errorMessage,
      };
    }

    return NextResponse.json({ result });
  } catch (err) {
    console.error('[setup/execute] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

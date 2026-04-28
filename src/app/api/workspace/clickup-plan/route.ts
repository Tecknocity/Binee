import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 10;

const VALID_TIERS = new Set(['free', 'unlimited', 'business', 'business_plus', 'enterprise']);

/**
 * PATCH /api/workspace/clickup-plan
 *
 * Phase 3: ClickUp plan tier is set by the user (profile form dropdown
 * or Settings), not scraped from ClickUp's API. This endpoint records
 * the user's choice with source='user' and stamps when they set it.
 *
 * Body: { workspace_id: uuid, plan_tier: 'free'|'unlimited'|'business'|'business_plus'|'enterprise' }
 *
 * Auth: caller must be a member of the workspace (verified via
 * workspace_members lookup against auth.uid()).
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      workspace_id?: string;
      plan_tier?: string;
    };
    const { workspace_id, plan_tier } = body;

    if (!workspace_id || typeof workspace_id !== 'string') {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }
    if (!plan_tier || !VALID_TIERS.has(plan_tier)) {
      return NextResponse.json(
        { error: `plan_tier must be one of: ${Array.from(VALID_TIERS).join(', ')}` },
        { status: 400 },
      );
    }

    // Verify membership before writing. The workspaces table has RLS, so
    // a non-member would just see an empty result, but checking
    // explicitly gives a clear 403 instead of a confusing 404 / silent
    // success.
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Service role write so the update bypasses any column-level RLS we
    // add later for read scoping. The membership check above is the
    // gate.
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { error: updateError } = await adminClient
      .from('workspaces')
      .update({
        clickup_plan_tier: plan_tier,
        clickup_plan_tier_source: 'user',
        clickup_plan_tier_set_at: new Date().toISOString(),
      })
      .eq('id', workspace_id);

    if (updateError) {
      console.error('[PATCH /api/workspace/clickup-plan] update failed:', updateError);
      return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 });
    }

    return NextResponse.json({
      workspace_id,
      plan_tier,
      source: 'user',
    });
  } catch (error) {
    console.error('[PATCH /api/workspace/clickup-plan] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

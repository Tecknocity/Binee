import { NextRequest, NextResponse } from 'next/server';
import { generateSetupPlan } from '@/lib/setup/planner';
import { createServerClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import type { BusinessProfile } from '@/lib/setup/types';

export const maxDuration = 60;

/**
 * POST /api/setup/generate-plan
 *
 * Generates a ClickUp workspace plan from a business profile.
 * This runs server-side to avoid exposing the Anthropic API key to the browser.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit(`setup-generate:${user.id}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const { businessProfile, workspaceAnalysis, conversationContext, previousPlan, planHistorySummary } = await request.json() as {
      businessProfile: BusinessProfile;
      workspaceAnalysis?: string;
      conversationContext?: string;
      previousPlan?: Record<string, unknown>;
      planHistorySummary?: string;
    };

    if (!businessProfile?.businessDescription) {
      return NextResponse.json({ error: 'Missing business description' }, { status: 400 });
    }

    const plan = await generateSetupPlan(businessProfile, workspaceAnalysis, {
      conversationContext,
      previousPlan,
      planHistorySummary,
    });

    return NextResponse.json({ plan });
  } catch (error) {
    console.error('[POST /api/setup/generate-plan] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Plan generation failed' },
      { status: 500 },
    );
  }
}

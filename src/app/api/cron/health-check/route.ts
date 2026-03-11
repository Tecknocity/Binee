import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runHealthCheck } from '@/lib/health/checker';

// Vercel Cron: runs daily at 6 AM UTC
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Get all connected workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id')
    .eq('clickup_connected', true);

  if (!workspaces || workspaces.length === 0) {
    return NextResponse.json({ message: 'No connected workspaces', checked: 0 });
  }

  let checked = 0;
  const errors: string[] = [];

  for (const ws of workspaces) {
    try {
      // Get previous score
      const { data: lastCheck } = await supabase
        .from('health_check_results')
        .select('overall_score')
        .eq('workspace_id', ws.id)
        .order('checked_at', { ascending: false })
        .limit(1)
        .single();

      const result = await runHealthCheck(ws.id, lastCheck?.overall_score);

      await supabase.from('health_check_results').insert({
        workspace_id: ws.id,
        overall_score: result.overall_score,
        category_scores: result.category_scores,
        issues: result.issues,
        recommendations: result.recommendations,
        previous_score: lastCheck?.overall_score ?? null,
        credits_used: 0, // Cron health checks are free
      });

      checked++;
    } catch (error) {
      errors.push(`${ws.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return NextResponse.json({ checked, errors });
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Cron: runs weekly on Sundays at 3 AM UTC
// Prunes cached_tasks (90 days) and webhook_events (30 days).
// webhook_events are pruned aggressively because structured data is
// permanently stored in task_activity_log.
// Does NOT prune structural data or task_activity_log (permanent).
export const dynamic = 'force-dynamic';

const RETENTION_DAYS = 90;
const WEBHOOK_RETENTION_DAYS = 30;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoff = cutoffDate.toISOString();

  const results: Record<string, number> = {};
  const errors: string[] = [];

  // Prune cached_tasks older than 90 days
  try {
    const { count } = await supabase
      .from('cached_tasks')
      .delete({ count: 'exact' })
      .lt('synced_at', cutoff);

    results.cached_tasks_deleted = count ?? 0;
  } catch (error) {
    errors.push(`cached_tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Prune raw webhook_events older than 30 days
  // (structured data already extracted into task_activity_log)
  const webhookCutoffDate = new Date();
  webhookCutoffDate.setDate(webhookCutoffDate.getDate() - WEBHOOK_RETENTION_DAYS);
  const webhookCutoff = webhookCutoffDate.toISOString();

  try {
    const { count } = await supabase
      .from('webhook_events')
      .delete({ count: 'exact' })
      .lt('created_at', webhookCutoff);

    results.webhook_events_deleted = count ?? 0;
  } catch (error) {
    errors.push(`webhook_events: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Prune old messages (keep last 90 days — conversations remain intact)
  try {
    const { count } = await supabase
      .from('messages')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff);

    results.messages_deleted = count ?? 0;
  } catch (error) {
    errors.push(`messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Prune old credit_transactions (keep last 90 days)
  try {
    const { count } = await supabase
      .from('credit_transactions')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff);

    results.credit_transactions_deleted = count ?? 0;
  } catch (error) {
    errors.push(`credit_transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Prune old credit_usage analytics (keep last 90 days)
  try {
    const { count } = await supabase
      .from('credit_usage')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff);

    results.credit_usage_deleted = count ?? 0;
  } catch (error) {
    errors.push(`credit_usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return NextResponse.json({
    cutoff,
    retention_days: RETENTION_DAYS,
    ...results,
    errors: errors.length > 0 ? errors : undefined,
  });
}

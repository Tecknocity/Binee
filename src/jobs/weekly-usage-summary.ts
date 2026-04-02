import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Weekly Usage Summary Cron Job
 *
 * Runs weekly (Monday 01:00 UTC via Vercel Cron).
 * Materializes usage data from credit_usage into weekly_usage_summaries.
 *
 * Vercel Cron config (vercel.json):
 *   { "path": "/api/cron/weekly-usage-summary", "schedule": "0 1 * * 1" }
 */
export async function generateWeeklyUsageSummaries() {
  // Calculate the week window: last Monday 00:00 UTC → this Monday 00:00 UTC
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const thisMonday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday,
    0, 0, 0, 0
  ));

  const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weekStart = lastMonday.toISOString();
  const weekEnd = thisMonday.toISOString();

  // Aggregate credit_usage for the past week per user
  const { data: usageRows, error: usageError } = await supabaseAdmin
    .from('credit_usage')
    .select('user_id, action_type, credits_deducted')
    .gte('created_at', weekStart)
    .lt('created_at', weekEnd);

  if (usageError) {
    console.error('Failed to fetch credit_usage:', usageError.message);
    return { success: false, error: usageError.message };
  }

  if (!usageRows || usageRows.length === 0) {
    console.log('No credit usage records for the past week.');
    return { success: true, processed: 0 };
  }

  // Group by user_id
  const userMap = new Map<string, {
    total: number;
    total_actions: number;
    chat: number;
    setup: number;
  }>();

  for (const row of usageRows) {
    let entry = userMap.get(row.user_id);
    if (!entry) {
      entry = { total: 0, total_actions: 0, chat: 0, setup: 0 };
      userMap.set(row.user_id, entry);
    }

    const credits = row.credits_deducted ?? 0;
    entry.total += credits;
    entry.total_actions += 1;

    const actionType = row.action_type as keyof typeof entry;
    if (actionType in entry && actionType !== 'total' && actionType !== 'total_actions') {
      (entry[actionType] as number) += credits;
    }
  }

  // Upsert into weekly_usage_summaries
  const upsertRows = Array.from(userMap.entries()).map(([userId, data]) => ({
    user_id: userId,
    week_start: weekStart,
    total_credits: Math.round(data.total * 100) / 100,
    total_actions: data.total_actions,
    chat_credits: Math.round(data.chat * 100) / 100,
    setup_credits: Math.round(data.setup * 100) / 100,
  }));

  const { error: upsertError } = await supabaseAdmin
    .from('weekly_usage_summaries')
    .upsert(upsertRows, { onConflict: 'user_id,week_start' });

  if (upsertError) {
    console.error('Failed to upsert weekly summaries:', upsertError.message);
    return { success: false, error: upsertError.message };
  }

  console.log(`Weekly usage summaries generated for ${upsertRows.length} users.`);
  return { success: true, processed: upsertRows.length };
}

import type { BineeContext } from '@/types/ai';
import { getModule } from '@/lib/ai/knowledge-base';

// ---------------------------------------------------------------------------
// Briefing / health prompt — loads `health-tracker` + `analyzer-auditor` from KB
// ---------------------------------------------------------------------------

const HEALTH_TRACKER_KEY = 'health-tracker';
const ANALYZER_AUDITOR_KEY = 'analyzer-auditor';

/**
 * Load the briefing/health analysis prompt from the knowledge base.
 *
 * Fetches:
 *   - `health-tracker` module: workspace health scoring methodology,
 *     metric definitions, threshold rules, trend analysis
 *   - `analyzer-auditor` module: audit checklists, diagnostic workflows,
 *     report formatting, severity classification
 *
 * Used for health checks, workspace audits, morning briefings, and
 * analysis-audit task types.
 */
export async function loadBriefingPrompt(context: BineeContext): Promise<string> {
  const [healthModule, auditorModule] = await Promise.all([
    getModule(HEALTH_TRACKER_KEY),
    getModule(ANALYZER_AUDITOR_KEY),
  ]);

  const parts: string[] = [];

  // 1. Health tracker brain module
  if (healthModule?.content) {
    parts.push(healthModule.content);
  } else {
    console.warn(`[briefing-prompt] KB module "${HEALTH_TRACKER_KEY}" not found — using fallback`);
    parts.push(FALLBACK_HEALTH_SECTION);
  }

  // 2. Analyzer/auditor brain module
  if (auditorModule?.content) {
    parts.push(auditorModule.content);
  } else {
    console.warn(`[briefing-prompt] KB module "${ANALYZER_AUDITOR_KEY}" not found — using fallback`);
    parts.push(FALLBACK_AUDITOR_SECTION);
  }

  return parts.join('\n\n---\n\n');
}

// ---------------------------------------------------------------------------
// Fallbacks — used only when KB is unavailable
// ---------------------------------------------------------------------------

const FALLBACK_HEALTH_SECTION = `## HEALTH ANALYSIS MODE
You are diagnosing the health of the user's workspace. Focus on:
1. Overdue tasks: how many, who owns them, how late.
2. Unassigned tasks: orphaned work that needs an owner.
3. Stale tasks: tasks with no updates in 7+ days.
4. Workload imbalance: team members with significantly more tasks than others.
5. Missing metadata: tasks without due dates, priorities, or descriptions.
6. Time tracking gaps: tasks with logged time vs. estimates.

Present findings as a structured report:
- Critical issues (needs immediate attention)
- Warnings (should address soon)
- Healthy areas (doing well)

Include specific numbers and actionable recommendations for each issue.`;

const FALLBACK_AUDITOR_SECTION = `## AUDIT & ANALYSIS
When performing analysis:
1. Start with an executive summary of overall workspace health.
2. Break down findings by category (overdue, unassigned, stale, workload, metadata).
3. Assign severity levels: critical, warning, or healthy.
4. Provide specific, actionable recommendations for each finding.
5. Compare against best practices where applicable.
6. Highlight positive trends alongside areas for improvement.`;

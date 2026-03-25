import type { BineeContext } from '@/types/ai';
import { getModule } from '@/lib/ai/knowledge-base';

// ---------------------------------------------------------------------------
// Dashboard prompt — loads `dashboard-builder` brain module from KB
// ---------------------------------------------------------------------------

const DASHBOARD_BUILDER_KEY = 'dashboard-builder';

/**
 * Load the dashboard builder prompt from the knowledge base.
 *
 * Fetches:
 *   - `dashboard-builder` module: widget type catalog, chart configuration
 *     patterns, data mapping rules, layout recommendations, dashboard
 *     composition best practices
 *
 * Used for dashboard_request task types — creating dashboards, adding
 * widgets, configuring charts, and building reporting views.
 */
export async function loadDashboardPrompt(context: BineeContext): Promise<string> {
  const mod = await getModule(DASHBOARD_BUILDER_KEY);

  if (!mod?.content) {
    console.warn(`[dashboard-prompt] KB module "${DASHBOARD_BUILDER_KEY}" not found — using fallback`);
    return FALLBACK_DASHBOARD_PROMPT;
  }

  return mod.content;
}

// ---------------------------------------------------------------------------
// Fallback — used only when KB is unavailable
// ---------------------------------------------------------------------------

const FALLBACK_DASHBOARD_PROMPT = `## DASHBOARD BUILDER MODE
You are helping the user create and customize their dashboards.

Key behaviors:
1. Ask whether to create a new dashboard or add to an existing one.
2. Use list_dashboards to see what exists before suggesting options.
3. Map user requests to the right widget type:
   - bar_chart: comparisons between categories
   - line_chart: trends over time
   - summary_card: single key metrics
   - table: detailed lists with sortable columns
4. Before modifying widgets, state what you intend to change and confirm.
5. After creating widgets, tell the user where to view them.
6. If requested data is unavailable, be honest and suggest alternatives.
7. Suggest complementary widgets to provide a complete picture.`;

import type { TaskType, ClassificationResult } from '@/types/ai';

// ---------------------------------------------------------------------------
// Keyword patterns for rule-based message classification
// Each task type maps to an array of RegExp patterns that signal intent.
// The classifier scores messages against all patterns and picks the best match.
// ---------------------------------------------------------------------------

const PATTERNS: Record<TaskType, RegExp[]> = {
  general_chat: [],  // No patterns — this is the fallback when nothing matches
  action_request: [
    /\b(create|update|assign|move|delete|remove|add|set|change|rename|close|reopen|complete|archive)\b/i,
    /\b(mark as|update to|assign to|create a task|change the status|move to)\b/i,
    /\b(set priority|add tag|remove tag|add comment)\b/i,
  ],
  complex_query: [
    /\b(analyze|compare|evaluate|assess|explain why|break down)\b/i,
    /\b(what are the|how does|why is|how do|what caused)\b.*\b(trend|pattern|metric|performance|workload)\b/i,
    /\b(bottleneck|risk|forecast|predict|prioritize|optimize)\b/i,
  ],
  setup_request: [
    /\b(set up|setup|restructure|reorganize|create a structure|configure|initialize)\b/i,
    /\b(I run a|help me organize|onboard|workspace setup)\b/i,
    /\b(workflow|process|template|folder structure|space structure)\b/i,
  ],
  health_check: [
    /\b(how'?s my workspace|health check|what'?s wrong|any issues)\b/i,
    /\b(workspace health|health score|overall status|diagnostic)\b/i,
    /\b(stale tasks|overdue|blockers|at risk)\b/i,
  ],
  dashboard_request: [
    /\b(build a dashboard|show me a chart|create a widget|track over time|add a widget|add widget)\b/i,
    /\b(visualize|graph|report|metric|kpi|dashboard|new dashboard|create dashboard)\b/i,
    /\b(burn ?down|velocity|throughput|update widget|delete widget|remove widget|modify widget)\b/i,
    /\b(change .*(chart|widget|graph|dashboard) to|switch .*(chart|widget) to)\b/i,
    /\b(add a filter|remove filter|change (the )?date range|last \d+ days|group by|sort by)\b.*\b(widget|chart|dashboard|graph)?\b/i,
    /\b(edit widget|reconfigure widget|change grouping|update the chart|modify the dashboard)\b/i,
  ],
  analysis_audit: [
    /\b(audit|review|improve|clean up|identify issues)\b/i,
    /\b(what needs attention|what can be improved|inefficienc|redundan)\b/i,
    /\b(unused|duplicate|stale|outdated|inconsisten)\b/i,
  ],
  strategy: [
    /\b(best practice|recommend|suggestion|advise|strategy|strategic)\b/i,
    /\b(how should I|what'?s the best way|should I|ideal|optimal)\b/i,
    /\b(plan|roadmap|approach|methodology|framework)\b/i,
  ],
  troubleshooting: [
    /\b(not working|error|broken|fail|issue|bug|problem)\b/i,
    /\b(can'?t|won'?t|doesn'?t|isn'?t|unable to|stuck)\b/i,
    /\b(fix|debug|troubleshoot|resolve|wrong|unexpected)\b/i,
  ],
  simple_lookup: [
    /\b(what are|how many|show me|list|status of|who is assigned|when is due)\b/i,
    /\b(tell me about|get|find|look up|check)\b/i,
    /\b(how much time|total tasks|count|what is)\b/i,
    /\b(busy|workload|schedule|on my plate|to do|tasks? (for |due )?today|what('s| is) (up|going on|happening)|pending)\b/i,
    /\b(my tasks|our tasks|any (tasks?|deadlines?|meetings?)|due (today|tomorrow|this week|soon))\b/i,
    /\b(what do (I|we) have|what('s| is) coming up|anything (due|overdue|urgent))\b/i,
    /\b(progress|summary|recap|update|report)\b.*\b(this week|last week|today|yesterday|this month|weekly|daily)\b/i,
    /\b(this week|last week|today|yesterday|this month|weekly|daily)\b.*\b(progress|summary|recap|update|report|tasks?)\b/i,
    /\b(what (did|have) (I|we) (done|completed|finished|accomplished))\b/i,
    /\b(summarize|summarise)\b.*\b(week|progress|work|tasks?)\b/i,
  ],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a user message into a TaskType using keyword pattern matching.
 * An optional `conversationContext` string (e.g. recent messages) can bias
 * scoring toward contextually appropriate categories.
 *
 * The returned taskType directly maps to which brain modules are loaded
 * from the ai_knowledge_base table via knowledge-base.ts.
 */
export function classifyMessage(
  message: string,
  conversationContext?: string,
): ClassificationResult {
  const textToAnalyze = conversationContext
    ? `${conversationContext}\n${message}`
    : message;

  const scores: Record<TaskType, number> = {
    general_chat: 0,
    simple_lookup: 0,
    complex_query: 0,
    action_request: 0,
    setup_request: 0,
    health_check: 0,
    dashboard_request: 0,
    analysis_audit: 0,
    strategy: 0,
    troubleshooting: 0,
  };

  // Score each category by counting pattern matches
  for (const [taskType, patterns] of Object.entries(PATTERNS)) {
    for (const pattern of patterns) {
      if (textToAnalyze.match(pattern)) {
        // Primary message matches weigh more than context matches
        const inPrimary = message.match(pattern);
        scores[taskType as TaskType] += inPrimary ? 2 : 1;
      }
    }
  }

  // Find the highest-scoring task type
  let bestType: TaskType = 'general_chat'; // default: general conversation (no workspace context needed)
  let bestScore = 0;

  for (const [taskType, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = taskType as TaskType;
    }
  }

  // Confidence is normalized: max possible per category is ~6 (3 patterns * 2)
  const confidence = bestScore > 0 ? Math.min(bestScore / 6, 1) : 0.3;

  const reasoning =
    bestScore > 0
      ? `Matched ${bestScore} keyword pattern(s) for "${bestType}"`
      : 'No workspace-specific patterns matched; routing as general chat';

  return {
    taskType: bestType,
    confidence,
    reasoning,
  };
}

import type {
  TaskType,
  ModelRouting,
  ClassificationResult,
} from '@/types/ai';

// ---------------------------------------------------------------------------
// Keyword patterns for rule-based classification
// ---------------------------------------------------------------------------

const PATTERNS: Record<TaskType, RegExp[]> = {
  simple_query: [
    /\b(what are|how many|show me|list|status of|who is assigned|when is due)\b/i,
    /\b(tell me about|get|find|look up|check)\b/i,
    /\b(how much time|total tasks|count)\b/i,
  ],
  simple_action: [
    /\b(mark as|update to|assign to|create a task|change the status|move to)\b/i,
    /\b(set priority|add tag|remove tag|close|reopen|complete)\b/i,
    /\b(rename|delete|archive)\b/i,
  ],
  complex_reasoning: [
    /\b(analyze|recommend|suggest|why is|what should|help me plan)\b/i,
    /\b(compare|evaluate|assess|prioritize|optimize|improve)\b/i,
    /\b(bottleneck|risk|trend|forecast|predict)\b/i,
  ],
  setup_planning: [
    /\b(set up|setup|restructure|reorganize|create a structure)\b/i,
    /\b(I run a|help me organize|onboard|configure|initialize)\b/i,
    /\b(workflow|process|template|workspace setup)\b/i,
  ],
  dashboard_design: [
    /\b(build a dashboard|show me a chart|create a widget|track over time|add a widget|add widget)\b/i,
    /\b(visualize|graph|report|metric|kpi|dashboard|new dashboard|create dashboard)\b/i,
    /\b(burn ?down|velocity|throughput|update widget|delete widget|remove widget|modify widget)\b/i,
  ],
  health_analysis: [
    /\b(how'?s my workspace|health check|what'?s wrong|any issues)\b/i,
    /\b(workspace health|status report|overall status|diagnostic)\b/i,
    /\b(stale tasks|overdue|blockers|at risk)\b/i,
  ],
};

// ---------------------------------------------------------------------------
// Model routing table
// ---------------------------------------------------------------------------

const MODEL_ROUTING: Record<TaskType, ModelRouting> = {
  simple_query: {
    model: 'haiku',
    modelId: 'claude-haiku-4-5-20251001',
    creditCost: 1,
  },
  simple_action: {
    model: 'haiku',
    modelId: 'claude-haiku-4-5-20251001',
    creditCost: 1,
  },
  complex_reasoning: {
    model: 'sonnet',
    modelId: 'claude-sonnet-4-6',
    creditCost: 3,
  },
  setup_planning: {
    model: 'sonnet',
    modelId: 'claude-sonnet-4-6',
    creditCost: 5,
  },
  dashboard_design: {
    model: 'sonnet',
    modelId: 'claude-sonnet-4-6',
    creditCost: 3,
  },
  health_analysis: {
    model: 'haiku',
    modelId: 'claude-haiku-4-5-20251001',
    creditCost: 2,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a user message into a TaskType using keyword pattern matching.
 * An optional `conversationContext` string (e.g. recent messages) can bias
 * scoring toward contextually appropriate categories.
 */
export function classifyMessage(
  message: string,
  conversationContext?: string,
): ClassificationResult {
  const textToAnalyze = conversationContext
    ? `${conversationContext}\n${message}`
    : message;

  const scores: Record<TaskType, number> = {
    simple_query: 0,
    simple_action: 0,
    complex_reasoning: 0,
    setup_planning: 0,
    dashboard_design: 0,
    health_analysis: 0,
  };

  // Score each category by counting pattern matches
  for (const [taskType, patterns] of Object.entries(PATTERNS)) {
    for (const pattern of patterns) {
      const matches = textToAnalyze.match(pattern);
      if (matches) {
        // Primary message matches weigh more than context matches
        const inPrimary = message.match(pattern);
        scores[taskType as TaskType] += inPrimary ? 2 : 1;
      }
    }
  }

  // Find the highest-scoring task type
  let bestType: TaskType = 'simple_query'; // default fallback
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
      : 'No strong pattern match; defaulting to simple_query';

  return {
    taskType: bestType,
    confidence,
    reasoning,
  };
}

/**
 * Return the model routing configuration for a given task type.
 */
export function getModelForTask(taskType: TaskType): ModelRouting {
  return MODEL_ROUTING[taskType];
}

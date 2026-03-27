import type {
  TaskType,
  ModelRouting,
  ModelConfig,
} from '@/types/ai';

// ---------------------------------------------------------------------------
// Model constants
// ---------------------------------------------------------------------------

const HAIKU_MODEL_ID = 'claude-haiku-4-5-20251001';
const SONNET_MODEL_ID = 'claude-sonnet-4-6';

const HAIKU_MAX_TOKENS = 2048;
const SONNET_MAX_TOKENS = 4096;

// ---------------------------------------------------------------------------
// Model routing table — maps classifier TaskType to AI model + credit cost
// ---------------------------------------------------------------------------

const MODEL_ROUTING: Record<TaskType, ModelRouting> = {
  general_chat: {
    model: 'haiku',
    modelId: HAIKU_MODEL_ID,
    creditCost: 1,
  },
  simple_lookup: {
    model: 'haiku',
    modelId: HAIKU_MODEL_ID,
    creditCost: 1,
  },
  complex_query: {
    model: 'sonnet',
    modelId: SONNET_MODEL_ID,
    creditCost: 3,
  },
  action_request: {
    model: 'sonnet',
    modelId: SONNET_MODEL_ID,
    creditCost: 3,
  },
  setup_request: {
    model: 'sonnet',
    modelId: SONNET_MODEL_ID,
    creditCost: 5,
  },
  health_check: {
    model: 'haiku',
    modelId: HAIKU_MODEL_ID,
    creditCost: 2,
  },
  dashboard_request: {
    model: 'sonnet',
    modelId: SONNET_MODEL_ID,
    creditCost: 3,
  },
  analysis_audit: {
    model: 'sonnet',
    modelId: SONNET_MODEL_ID,
    creditCost: 3,
  },
  strategy: {
    model: 'sonnet',
    modelId: SONNET_MODEL_ID,
    creditCost: 3,
  },
  troubleshooting: {
    model: 'haiku',
    modelId: HAIKU_MODEL_ID,
    creditCost: 2,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the model routing configuration for a given task type.
 */
export function getModelForTask(taskType: TaskType): ModelRouting {
  return MODEL_ROUTING[taskType];
}

/**
 * Route a classified task type to the appropriate Claude model and max_tokens.
 *
 * Haiku: simple_lookup, health_check, troubleshooting
 * Sonnet: complex_query, action_request, setup_request, dashboard_request,
 *         analysis_audit, strategy
 */
export function routeToModel(taskType: TaskType): ModelConfig {
  const routing = MODEL_ROUTING[taskType];
  return {
    model: routing.modelId,
    maxTokens: routing.model === 'haiku' ? HAIKU_MAX_TOKENS : SONNET_MAX_TOKENS,
  };
}

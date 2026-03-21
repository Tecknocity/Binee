import type {
  TaskType,
  ModelRouting,
} from '@/types/ai';

// ---------------------------------------------------------------------------
// Model routing table — maps classifier TaskType to AI model + credit cost
// ---------------------------------------------------------------------------

const MODEL_ROUTING: Record<TaskType, ModelRouting> = {
  simple_lookup: {
    model: 'haiku',
    modelId: 'claude-haiku-4-5-20251001',
    creditCost: 1,
  },
  complex_query: {
    model: 'sonnet',
    modelId: 'claude-sonnet-4-6',
    creditCost: 3,
  },
  action_request: {
    model: 'haiku',
    modelId: 'claude-haiku-4-5-20251001',
    creditCost: 1,
  },
  setup_request: {
    model: 'sonnet',
    modelId: 'claude-sonnet-4-6',
    creditCost: 5,
  },
  health_check: {
    model: 'haiku',
    modelId: 'claude-haiku-4-5-20251001',
    creditCost: 2,
  },
  dashboard_request: {
    model: 'sonnet',
    modelId: 'claude-sonnet-4-6',
    creditCost: 3,
  },
  analysis_audit: {
    model: 'sonnet',
    modelId: 'claude-sonnet-4-6',
    creditCost: 3,
  },
  strategy: {
    model: 'sonnet',
    modelId: 'claude-sonnet-4-6',
    creditCost: 3,
  },
  troubleshooting: {
    model: 'haiku',
    modelId: 'claude-haiku-4-5-20251001',
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

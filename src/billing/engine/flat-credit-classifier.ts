import { MESSAGE_CREDIT_TIERS, type MessageTier } from '../config';

export interface MessageClassification {
  tier: MessageTier;
  creditsToCharge: number;
  compositeScore: number;
  subAgentCalls: number;
  isSetup: boolean;
}

/**
 * Input signals for composite scoring.
 * All fields are collected AFTER message processing by the orchestrator.
 */
export interface ClassificationInput {
  subAgentCalls: number;
  toolCallCount: number;
  imageCount: number;
  fileCount: number;
  hasWriteOps: boolean;
  isSetup: boolean;
}

// Tool names that count as write operations (creating/modifying workspace data)
const WRITE_TOOL_NAMES = new Set([
  'create_task', 'update_task', 'delete_task', 'move_task',
  'create_doc', 'create_doc_page', 'update_doc_page',
  'create_goal', 'update_goal', 'create_key_result',
  'add_tag_to_task', 'remove_tag_from_task',
  'create_task_comment',
  'add_time_entry', 'start_time_tracking', 'stop_time_tracking',
]);

/**
 * Check whether any of the tool call names represent write operations.
 */
export function hasWriteOperations(toolCallNames: string[]): boolean {
  return toolCallNames.some(name => WRITE_TOOL_NAMES.has(name));
}

/**
 * Calculate composite score from 5 signals. Range: 0-8.
 *
 * | Signal            | 0 pts       | 1 pt         | 2 pts       |
 * |-------------------|-------------|--------------|-------------|
 * | Sub-agent depth   | 0 agents    | 1 agent      | 2+ agents   |
 * | Tool complexity   | 0-2 calls   | 3-6 calls    | 7+ calls    |
 * | Images attached   | None        | 1 image      | 2+ images   |
 * | Files attached    | None        | 1+ files     | (max 1 pt)  |
 * | Write operations  | None        | 1+ writes    | (max 1 pt)  |
 */
export function calculateCompositeScore(input: ClassificationInput): number {
  let score = 0;

  // Sub-agent depth (0-2 pts)
  if (input.subAgentCalls >= 2) score += 2;
  else if (input.subAgentCalls === 1) score += 1;

  // Tool complexity (0-2 pts)
  if (input.toolCallCount >= 7) score += 2;
  else if (input.toolCallCount >= 3) score += 1;

  // Images (0-2 pts)
  if (input.imageCount >= 2) score += 2;
  else if (input.imageCount >= 1) score += 1;

  // Files (0-1 pt)
  if (input.fileCount >= 1) score += 1;

  // Write operations (0-1 pt)
  if (input.hasWriteOps) score += 1;

  return score;
}

/**
 * Map composite score to credit tier.
 *
 * Score 0-1 → light    (0.55 credits)
 * Score 2-3 → standard (0.85 credits)
 * Score 4-5 → heavy    (1.30 credits)
 * Score 6-8 → premium  (2.00 credits)
 */
function scoreToTier(score: number): MessageTier {
  if (score <= 1) return 'light';
  if (score <= 3) return 'standard';
  if (score <= 5) return 'heavy';
  return 'premium';
}

/**
 * Classify a processed message into a credit tier.
 *
 * Called AFTER the message has been fully processed by the orchestrator.
 * Uses composite scoring across 5 signals to determine the flat credit charge.
 * Setup messages always use the premium tier.
 */
export function classifyMessageCost(input: ClassificationInput): MessageClassification {
  // Setup always charges premium
  if (input.isSetup) {
    return {
      tier: 'premium',
      creditsToCharge: MESSAGE_CREDIT_TIERS.premium,
      compositeScore: 8,
      subAgentCalls: input.subAgentCalls,
      isSetup: true,
    };
  }

  const compositeScore = calculateCompositeScore(input);
  const tier = scoreToTier(compositeScore);

  return {
    tier,
    creditsToCharge: MESSAGE_CREDIT_TIERS[tier],
    compositeScore,
    subAgentCalls: input.subAgentCalls,
    isSetup: false,
  };
}

import { MESSAGE_CREDIT_TIERS, type MessageTier } from '../config';

export interface MessageClassification {
  tier: MessageTier;
  creditsToCharge: number;
  subAgentCalls: number;
  isSetup: boolean;
}

/**
 * Classify a processed message into a credit tier.
 *
 * Called AFTER the message has been fully processed by the orchestrator.
 * The orchestrator passes in what happened during processing:
 * - How many sub-agents were called
 * - Whether this was a setup request
 *
 * Returns the flat credit amount to deduct.
 */
export function classifyMessageCost(
  subAgentCalls: number,
  isSetup: boolean,
): MessageClassification {
  let tier: MessageTier;

  if (isSetup) {
    tier = 'complex';
  } else if (subAgentCalls === 0) {
    tier = 'simple';
  } else if (subAgentCalls === 1) {
    tier = 'standard';
  } else {
    tier = 'complex';
  }

  return {
    tier,
    creditsToCharge: MESSAGE_CREDIT_TIERS[tier],
    subAgentCalls,
    isSetup,
  };
}

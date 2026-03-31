import { ANTHROPIC_RATES } from '../config';

type ModelName = keyof typeof ANTHROPIC_RATES;

export interface TokenCostResult {
  inputCostCents: number;
  outputCostCents: number;
  totalCostCents: number;
}

/**
 * Convert raw Anthropic token counts into dollar cost.
 *
 * ANALYTICS ONLY — this is NOT used for billing.
 * Billing uses flat credit tiers via classifyMessageCost().
 *
 * This function tracks our actual Anthropic spend per message
 * for internal cost monitoring and margin analysis.
 */
export function calculateAnthropicCost(usage: {
  input_tokens: number;
  output_tokens: number;
  model: ModelName;
}): TokenCostResult {
  const rates = ANTHROPIC_RATES[usage.model];

  const inputCostDollars = (usage.input_tokens / 1_000_000) * rates.input;
  const outputCostDollars = (usage.output_tokens / 1_000_000) * rates.output;
  const totalCostDollars = inputCostDollars + outputCostDollars;

  return {
    inputCostCents: inputCostDollars * 100,
    outputCostCents: outputCostDollars * 100,
    totalCostCents: totalCostDollars * 100,
  };
}

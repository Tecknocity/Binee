import { ANTHROPIC_RATES, CREDIT_COST_VALUE } from '../config';

type ModelName = keyof typeof ANTHROPIC_RATES;

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  model: ModelName;
}

export interface TokenConversionResult {
  /** Exact cost for input tokens in cents */
  inputCostCents: number;
  /** Exact cost for output tokens in cents */
  outputCostCents: number;
  /** Total Anthropic cost in cents */
  totalCostCents: number;
  /** Exact decimal credits consumed (e.g., 0.4523) */
  creditsConsumed: number;
}

/**
 * Convert raw Anthropic token counts into credit cost.
 *
 * Called after every Anthropic API response.
 * Uses rates from config and converts dollar cost to credits
 * where 1 credit = $CREDIT_COST_VALUE of Anthropic cost.
 */
export function tokensToCredits(usage: AnthropicUsage): TokenConversionResult {
  const rates = ANTHROPIC_RATES[usage.model];

  // Rates are $ per million tokens
  const inputCostDollars = (usage.input_tokens / 1_000_000) * rates.input;
  const outputCostDollars = (usage.output_tokens / 1_000_000) * rates.output;
  const totalCostDollars = inputCostDollars + outputCostDollars;

  // Convert dollar cost to credits: $0.02 of cost = 1 credit
  const creditsConsumed = totalCostDollars / CREDIT_COST_VALUE;

  return {
    inputCostCents: inputCostDollars * 100,
    outputCostCents: outputCostDollars * 100,
    totalCostCents: totalCostDollars * 100,
    creditsConsumed,
  };
}

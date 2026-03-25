import { describe, it, expect } from 'vitest';
import { tokensToCredits } from '../token-converter';

describe('tokensToCredits', () => {
  // PRD verification examples
  it('Haiku: 1000 input + 500 output = 0.175 credits', () => {
    const result = tokensToCredits({
      input_tokens: 1000,
      output_tokens: 500,
      model: 'haiku',
    });

    // Input:  1000 / 1_000_000 * $1.00 = $0.001
    // Output: 500  / 1_000_000 * $5.00 = $0.0025
    // Total:  $0.0035 / $0.02 = 0.175 credits
    expect(result.inputCostCents).toBeCloseTo(0.1, 6);
    expect(result.outputCostCents).toBeCloseTo(0.25, 6);
    expect(result.totalCostCents).toBeCloseTo(0.35, 6);
    expect(result.creditsConsumed).toBeCloseTo(0.175, 6);
  });

  it('Sonnet: 2000 input + 1000 output = 1.05 credits', () => {
    const result = tokensToCredits({
      input_tokens: 2000,
      output_tokens: 1000,
      model: 'sonnet',
    });

    // Input:  2000 / 1_000_000 * $3.00 = $0.006
    // Output: 1000 / 1_000_000 * $15.00 = $0.015
    // Total:  $0.021 / $0.02 = 1.05 credits
    expect(result.inputCostCents).toBeCloseTo(0.6, 6);
    expect(result.outputCostCents).toBeCloseTo(1.5, 6);
    expect(result.totalCostCents).toBeCloseTo(2.1, 6);
    expect(result.creditsConsumed).toBeCloseTo(1.05, 6);
  });

  it('Opus: 5000 input + 2000 output = 3.75 credits', () => {
    const result = tokensToCredits({
      input_tokens: 5000,
      output_tokens: 2000,
      model: 'opus',
    });

    // Input:  5000 / 1_000_000 * $5.00 = $0.025
    // Output: 2000 / 1_000_000 * $25.00 = $0.05
    // Total:  $0.075 / $0.02 = 3.75 credits
    expect(result.inputCostCents).toBeCloseTo(2.5, 6);
    expect(result.outputCostCents).toBeCloseTo(5.0, 6);
    expect(result.totalCostCents).toBeCloseTo(7.5, 6);
    expect(result.creditsConsumed).toBeCloseTo(3.75, 6);
  });

  it('handles zero tokens', () => {
    const result = tokensToCredits({
      input_tokens: 0,
      output_tokens: 0,
      model: 'haiku',
    });

    expect(result.inputCostCents).toBe(0);
    expect(result.outputCostCents).toBe(0);
    expect(result.totalCostCents).toBe(0);
    expect(result.creditsConsumed).toBe(0);
  });

  it('handles input-only (no output tokens)', () => {
    const result = tokensToCredits({
      input_tokens: 1_000_000,
      output_tokens: 0,
      model: 'sonnet',
    });

    // 1M input tokens * $3/M = $3.00 / $0.02 = 150 credits
    expect(result.creditsConsumed).toBeCloseTo(150, 6);
    expect(result.outputCostCents).toBe(0);
  });

  it('handles output-only (no input tokens)', () => {
    const result = tokensToCredits({
      input_tokens: 0,
      output_tokens: 1_000_000,
      model: 'haiku',
    });

    // 1M output tokens * $5/M = $5.00 / $0.02 = 250 credits
    expect(result.creditsConsumed).toBeCloseTo(250, 6);
    expect(result.inputCostCents).toBe(0);
  });

  it('handles large token counts accurately', () => {
    const result = tokensToCredits({
      input_tokens: 100_000,
      output_tokens: 50_000,
      model: 'opus',
    });

    // Input:  100_000 / 1_000_000 * $5 = $0.50
    // Output: 50_000  / 1_000_000 * $25 = $1.25
    // Total:  $1.75 / $0.02 = 87.5 credits
    expect(result.creditsConsumed).toBeCloseTo(87.5, 6);
  });
});

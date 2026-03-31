import { describe, it, expect } from 'vitest';
import { calculateAnthropicCost } from '../token-converter';

describe('calculateAnthropicCost', () => {
  it('Haiku: 1000 input + 500 output cost', () => {
    const result = calculateAnthropicCost({
      input_tokens: 1000,
      output_tokens: 500,
      model: 'haiku',
    });

    // Input:  1000 / 1_000_000 * $0.80 = $0.0008
    // Output: 500  / 1_000_000 * $4.00 = $0.002
    // Total:  $0.0028
    expect(result.inputCostCents).toBeCloseTo(0.08, 6);
    expect(result.outputCostCents).toBeCloseTo(0.2, 6);
    expect(result.totalCostCents).toBeCloseTo(0.28, 6);
  });

  it('Sonnet: 2000 input + 1000 output cost', () => {
    const result = calculateAnthropicCost({
      input_tokens: 2000,
      output_tokens: 1000,
      model: 'sonnet',
    });

    // Input:  2000 / 1_000_000 * $3.00 = $0.006
    // Output: 1000 / 1_000_000 * $15.00 = $0.015
    // Total:  $0.021
    expect(result.inputCostCents).toBeCloseTo(0.6, 6);
    expect(result.outputCostCents).toBeCloseTo(1.5, 6);
    expect(result.totalCostCents).toBeCloseTo(2.1, 6);
  });

  it('handles zero tokens', () => {
    const result = calculateAnthropicCost({
      input_tokens: 0,
      output_tokens: 0,
      model: 'haiku',
    });

    expect(result.inputCostCents).toBe(0);
    expect(result.outputCostCents).toBe(0);
    expect(result.totalCostCents).toBe(0);
  });

  it('handles input-only (no output tokens)', () => {
    const result = calculateAnthropicCost({
      input_tokens: 1_000_000,
      output_tokens: 0,
      model: 'sonnet',
    });

    // 1M input tokens * $3/M = $3.00 = 300 cents
    expect(result.totalCostCents).toBeCloseTo(300, 6);
    expect(result.outputCostCents).toBe(0);
  });

  it('handles output-only (no input tokens)', () => {
    const result = calculateAnthropicCost({
      input_tokens: 0,
      output_tokens: 1_000_000,
      model: 'haiku',
    });

    // 1M output tokens * $4/M = $4.00 = 400 cents
    expect(result.totalCostCents).toBeCloseTo(400, 6);
    expect(result.inputCostCents).toBe(0);
  });

  it('handles large token counts accurately', () => {
    const result = calculateAnthropicCost({
      input_tokens: 100_000,
      output_tokens: 50_000,
      model: 'sonnet',
    });

    // Input:  100_000 / 1_000_000 * $3 = $0.30 = 30 cents
    // Output: 50_000  / 1_000_000 * $15 = $0.75 = 75 cents
    // Total:  $1.05 = 105 cents
    expect(result.totalCostCents).toBeCloseTo(105, 6);
  });
});

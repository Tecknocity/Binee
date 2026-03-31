import { describe, it, expect } from 'vitest';
import { classifyMessageCost } from '../flat-credit-classifier';

describe('classifyMessageCost', () => {
  it('returns simple (0.55) when no sub-agents and not setup', () => {
    const result = classifyMessageCost(0, false);
    expect(result.tier).toBe('simple');
    expect(result.creditsToCharge).toBe(0.55);
  });

  it('returns standard (0.70) when 1 sub-agent called', () => {
    const result = classifyMessageCost(1, false);
    expect(result.tier).toBe('standard');
    expect(result.creditsToCharge).toBe(0.70);
  });

  it('returns complex (1.00) when 2+ sub-agents called', () => {
    const result = classifyMessageCost(2, false);
    expect(result.tier).toBe('complex');
    expect(result.creditsToCharge).toBe(1.00);
  });

  it('returns complex (1.00) when 3 sub-agents called', () => {
    const result = classifyMessageCost(3, false);
    expect(result.tier).toBe('complex');
    expect(result.creditsToCharge).toBe(1.00);
  });

  it('returns complex (1.00) for setup regardless of sub-agent count', () => {
    const result = classifyMessageCost(0, true);
    expect(result.tier).toBe('complex');
    expect(result.creditsToCharge).toBe(1.00);
  });

  it('returns complex (1.00) for setup with sub-agents', () => {
    const result = classifyMessageCost(1, true);
    expect(result.tier).toBe('complex');
    expect(result.creditsToCharge).toBe(1.00);
  });
});

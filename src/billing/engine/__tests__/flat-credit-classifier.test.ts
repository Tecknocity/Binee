import { describe, it, expect } from 'vitest';
import {
  classifyMessageCost,
  calculateCompositeScore,
  hasWriteOperations,
  type ClassificationInput,
} from '../flat-credit-classifier';

// Helper to build input with defaults
function input(overrides: Partial<ClassificationInput> = {}): ClassificationInput {
  return {
    subAgentCalls: 0,
    toolCallCount: 0,
    imageCount: 0,
    fileCount: 0,
    hasWriteOps: false,
    isSetup: false,
    ...overrides,
  };
}

describe('calculateCompositeScore', () => {
  it('returns 0 for empty input', () => {
    expect(calculateCompositeScore(input())).toBe(0);
  });

  it('scores sub-agent depth: 1 agent = 1 pt, 2+ agents = 2 pts', () => {
    expect(calculateCompositeScore(input({ subAgentCalls: 1 }))).toBe(1);
    expect(calculateCompositeScore(input({ subAgentCalls: 2 }))).toBe(2);
    expect(calculateCompositeScore(input({ subAgentCalls: 3 }))).toBe(2);
  });

  it('scores tool complexity: 3-6 calls = 1 pt, 7+ calls = 2 pts', () => {
    expect(calculateCompositeScore(input({ toolCallCount: 2 }))).toBe(0);
    expect(calculateCompositeScore(input({ toolCallCount: 3 }))).toBe(1);
    expect(calculateCompositeScore(input({ toolCallCount: 6 }))).toBe(1);
    expect(calculateCompositeScore(input({ toolCallCount: 7 }))).toBe(2);
  });

  it('scores images: 1 = 1 pt, 2+ = 2 pts', () => {
    expect(calculateCompositeScore(input({ imageCount: 1 }))).toBe(1);
    expect(calculateCompositeScore(input({ imageCount: 2 }))).toBe(2);
    expect(calculateCompositeScore(input({ imageCount: 3 }))).toBe(2);
  });

  it('scores files: 1+ = 1 pt', () => {
    expect(calculateCompositeScore(input({ fileCount: 0 }))).toBe(0);
    expect(calculateCompositeScore(input({ fileCount: 1 }))).toBe(1);
    expect(calculateCompositeScore(input({ fileCount: 3 }))).toBe(1);
  });

  it('scores write ops: any = 1 pt', () => {
    expect(calculateCompositeScore(input({ hasWriteOps: false }))).toBe(0);
    expect(calculateCompositeScore(input({ hasWriteOps: true }))).toBe(1);
  });

  it('reaches max score of 8', () => {
    expect(calculateCompositeScore(input({
      subAgentCalls: 2,
      toolCallCount: 10,
      imageCount: 3,
      fileCount: 1,
      hasWriteOps: true,
    }))).toBe(8);
  });
});

describe('hasWriteOperations', () => {
  it('returns false for read-only tool calls', () => {
    expect(hasWriteOperations(['get_workspace_summary', 'lookup_tasks'])).toBe(false);
  });

  it('returns true when any write tool is present', () => {
    expect(hasWriteOperations(['get_workspace_summary', 'create_task'])).toBe(true);
    expect(hasWriteOperations(['update_doc_page'])).toBe(true);
    expect(hasWriteOperations(['create_goal'])).toBe(true);
  });

  it('returns false for empty array', () => {
    expect(hasWriteOperations([])).toBe(false);
  });
});

describe('classifyMessageCost', () => {
  it('returns light (0.55) for simple direct answer (score 0)', () => {
    const result = classifyMessageCost(input());
    expect(result.tier).toBe('light');
    expect(result.creditsToCharge).toBe(0.55);
    expect(result.compositeScore).toBe(0);
  });

  it('returns light (0.55) for score 1 (e.g. 1 image, no agents)', () => {
    const result = classifyMessageCost(input({ imageCount: 1 }));
    expect(result.tier).toBe('light');
    expect(result.creditsToCharge).toBe(0.55);
    expect(result.compositeScore).toBe(1);
  });

  it('returns standard (0.85) for score 2 (e.g. 1 sub-agent + 1 file)', () => {
    const result = classifyMessageCost(input({ subAgentCalls: 1, fileCount: 1 }));
    expect(result.tier).toBe('standard');
    expect(result.creditsToCharge).toBe(0.85);
    expect(result.compositeScore).toBe(2);
  });

  it('returns standard (0.85) for score 3', () => {
    const result = classifyMessageCost(input({ subAgentCalls: 1, toolCallCount: 4 }));
    expect(result.tier).toBe('standard');
    expect(result.creditsToCharge).toBe(0.85);
    expect(result.compositeScore).toBe(2); // 1 (agent) + 1 (tools 3-6)
  });

  it('returns heavy (1.30) for score 4', () => {
    const result = classifyMessageCost(input({
      subAgentCalls: 2,
      toolCallCount: 5,
      imageCount: 1,
    }));
    expect(result.tier).toBe('heavy');
    expect(result.creditsToCharge).toBe(1.30);
    expect(result.compositeScore).toBe(4); // 2 + 1 + 1
  });

  it('returns heavy (1.30) for score 5', () => {
    const result = classifyMessageCost(input({
      subAgentCalls: 2,
      toolCallCount: 5,
      imageCount: 1,
      fileCount: 1,
    }));
    expect(result.tier).toBe('heavy');
    expect(result.creditsToCharge).toBe(1.30);
    expect(result.compositeScore).toBe(5);
  });

  it('returns premium (2.00) for score 6+', () => {
    const result = classifyMessageCost(input({
      subAgentCalls: 2,
      toolCallCount: 8,
      imageCount: 2,
    }));
    expect(result.tier).toBe('premium');
    expect(result.creditsToCharge).toBe(2.00);
    expect(result.compositeScore).toBe(6);
  });

  it('returns premium (2.00) for max score 8', () => {
    const result = classifyMessageCost(input({
      subAgentCalls: 2,
      toolCallCount: 10,
      imageCount: 3,
      fileCount: 1,
      hasWriteOps: true,
    }));
    expect(result.tier).toBe('premium');
    expect(result.creditsToCharge).toBe(2.00);
    expect(result.compositeScore).toBe(8);
  });

  it('returns premium (2.00) for setup regardless of signals', () => {
    const result = classifyMessageCost(input({ isSetup: true }));
    expect(result.tier).toBe('premium');
    expect(result.creditsToCharge).toBe(2.00);
    expect(result.compositeScore).toBe(8);
    expect(result.isSetup).toBe(true);
  });

  it('returns premium (2.00) for setup even with low signals', () => {
    const result = classifyMessageCost(input({
      subAgentCalls: 0,
      toolCallCount: 0,
      isSetup: true,
    }));
    expect(result.tier).toBe('premium');
    expect(result.creditsToCharge).toBe(2.00);
  });
});

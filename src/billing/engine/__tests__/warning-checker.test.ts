import { describe, it, expect } from 'vitest';
import { checkCreditWarnings } from '../warning-checker';

describe('checkCreditWarnings', () => {
  it('returns null when balance is healthy (> 10)', () => {
    const result = checkCreditWarnings({
      subscription_balance: 50,
      paygo_balance: 10,
    });
    expect(result).toBeNull();
  });

  it('returns low warning at exactly 10 credits', () => {
    const result = checkCreditWarnings({
      subscription_balance: 7,
      paygo_balance: 3.9, // floor = 10
    });
    expect(result).not.toBeNull();
    expect(result!.warning_type).toBe('low');
    expect(result!.message).toContain('10');
  });

  it('returns critical warning at 3 credits', () => {
    const result = checkCreditWarnings({
      subscription_balance: 2,
      paygo_balance: 1.5, // floor = 3
    });
    expect(result).not.toBeNull();
    expect(result!.warning_type).toBe('critical');
  });

  it('returns empty warning at 0 credits', () => {
    const result = checkCreditWarnings({
      subscription_balance: 0,
      paygo_balance: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.warning_type).toBe('empty');
  });

  it('returns empty warning when balance is slightly above zero but floors to 0', () => {
    const result = checkCreditWarnings({
      subscription_balance: 0.3,
      paygo_balance: 0.4, // floor = 0
    });
    expect(result).not.toBeNull();
    expect(result!.warning_type).toBe('empty');
  });

  it('returns low warning with interpolated credit count', () => {
    const result = checkCreditWarnings({
      subscription_balance: 5,
      paygo_balance: 2, // floor = 7
    });
    expect(result).not.toBeNull();
    expect(result!.warning_type).toBe('low');
    expect(result!.message).toContain('7');
  });
});

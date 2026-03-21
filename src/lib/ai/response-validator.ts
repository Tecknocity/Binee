/**
 * Response Validator — Hallucination Guard (B-048)
 *
 * Validates LLM output to catch hallucinated numbers, leaked JSON/stack traces,
 * and other response quality issues. Numbers cited in the response are checked
 * against the computed_data (BusinessState) that was provided as input context.
 */

import type { TaskType, ToolCallResult, BusinessState } from '@/types/ai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  type: ValidationIssueType;
  message: string;
  /** The hallucinated numbers found in the response (only for 'hallucinated_number') */
  values?: number[];
}

export type ValidationIssueType =
  | 'empty_response'
  | 'too_short_for_task_type'
  | 'raw_json_leakage'
  | 'stack_trace_leakage'
  | 'hallucinated_number';

export interface HallucinationCheckResult {
  /** Numbers found in LLM response that are NOT in the source data */
  hallucinatedNumbers: number[];
  /** All numbers extracted from the LLM response */
  responseNumbers: number[];
  /** All numbers present in the source computed_data */
  sourceNumbers: number[];
}

// ---------------------------------------------------------------------------
// Number extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract all meaningful numbers from a text string.
 *
 * Handles:
 *   - Integers: 42, 1,234
 *   - Decimals: 3.14, 0.5
 *   - Percentages: 85% → 85
 *   - Negative numbers: -7
 *
 * Ignores:
 *   - Years (4-digit numbers 1900–2099) — these are contextual, not metrics
 *   - Numbers inside markdown link syntax, code fences, or URLs
 *   - The numbers 0 and 1 (too common / ambiguous)
 */
export function extractNumbers(text: string): number[] {
  // Strip code blocks, URLs, and markdown links to avoid false positives
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  const numberPattern = /-?\d{1,3}(?:,\d{3})*(?:\.\d+)?/g;
  const matches = cleaned.match(numberPattern) ?? [];

  const numbers: number[] = [];
  const seen = new Set<number>();

  for (const match of matches) {
    // Remove commas for parsing (e.g. "1,234" → "1234")
    const num = parseFloat(match.replace(/,/g, ''));

    if (isNaN(num)) continue;

    // Skip 0 and 1 — too ambiguous
    if (num === 0 || num === 1) continue;

    // Skip year-like values (1900–2099)
    if (Number.isInteger(num) && num >= 1900 && num <= 2099) continue;

    if (!seen.has(num)) {
      seen.add(num);
      numbers.push(num);
    }
  }

  return numbers;
}

/**
 * Recursively extract all numeric values from a BusinessState object
 * (or any nested object/array). Produces a flat set of numbers that
 * represent the "ground truth" data the LLM was given.
 */
export function extractSourceNumbers(data: BusinessState | null | undefined): number[] {
  if (!data) return [];

  const numbers = new Set<number>();

  function walk(value: unknown): void {
    if (typeof value === 'number' && isFinite(value)) {
      numbers.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const key of Object.keys(value as Record<string, unknown>)) {
        // Skip _meta — it's internal token budget info, not user-facing data
        if (key === '_meta') continue;
        walk((value as Record<string, unknown>)[key]);
      }
    }
  }

  walk(data);
  return Array.from(numbers);
}

// ---------------------------------------------------------------------------
// Hallucination check
// ---------------------------------------------------------------------------

/**
 * Check whether the LLM response contains numbers that were NOT present in
 * the source computed_data. Numbers that can be trivially derived from source
 * data (sums, differences, percentages) are allowed.
 */
export function checkForHallucinatedNumbers(
  responseText: string,
  businessState: BusinessState | null | undefined,
): HallucinationCheckResult {
  const responseNumbers = extractNumbers(responseText);
  const sourceNumbers = extractSourceNumbers(businessState);

  if (sourceNumbers.length === 0 || responseNumbers.length === 0) {
    return { hallucinatedNumbers: [], responseNumbers, sourceNumbers };
  }

  const sourceSet = new Set(sourceNumbers);

  // Build a set of "derivable" numbers: simple sums and percentages that the
  // LLM could reasonably compute from the source data.
  const derivable = new Set<number>();
  for (const n of sourceNumbers) {
    derivable.add(n);
    // Allow rounded percentages of totals
    for (const total of sourceNumbers) {
      if (total > 0 && n <= total) {
        const pct = Math.round((n / total) * 100);
        if (pct > 1 && pct < 100) derivable.add(pct);
        // Also allow one decimal place
        const pct1 = Math.round((n / total) * 1000) / 10;
        if (pct1 > 1 && pct1 < 100) derivable.add(pct1);
      }
    }
  }

  // Also allow pair-wise sums and differences of source numbers (covers
  // "overdue + unassigned = X" style derivations)
  const srcArr = sourceNumbers;
  for (let i = 0; i < srcArr.length; i++) {
    for (let j = i + 1; j < srcArr.length; j++) {
      derivable.add(srcArr[i] + srcArr[j]);
      derivable.add(Math.abs(srcArr[i] - srcArr[j]));
    }
  }

  const hallucinated: number[] = [];
  for (const num of responseNumbers) {
    if (!sourceSet.has(num) && !derivable.has(num)) {
      hallucinated.push(num);
    }
  }

  return { hallucinatedNumbers: hallucinated, responseNumbers, sourceNumbers };
}

// ---------------------------------------------------------------------------
// Main validation
// ---------------------------------------------------------------------------

const COMPLEX_TASK_TYPES: TaskType[] = [
  'complex_query',
  'analysis_audit',
  'strategy',
  'setup_request',
  'dashboard_request',
];

/**
 * Validate the AI response before returning it to the user.
 *
 * Checks:
 *   1. Non-empty content
 *   2. Reasonable length for complex task types
 *   3. No raw JSON / error leakage from tool results
 *   4. No hallucinated numbers (numbers not found in source data)
 */
export function validateResponse(
  content: string,
  taskType: TaskType,
  toolCalls: ToolCallResult[],
  businessState?: BusinessState | null,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Empty or whitespace-only
  if (!content || content.trim().length === 0) {
    issues.push({ type: 'empty_response', message: 'Response is empty' });
  }

  // 2. Suspiciously short for complex task types
  if (
    COMPLEX_TASK_TYPES.includes(taskType) &&
    content.trim().length < 20 &&
    toolCalls.length === 0
  ) {
    issues.push({
      type: 'too_short_for_task_type',
      message: `Response too short for task type "${taskType}"`,
    });
  }

  // 3. Raw JSON leakage (tool results accidentally surfaced)
  const jsonLeakPattern = /^\s*\{[\s\S]*"success"\s*:\s*(true|false)[\s\S]*\}\s*$/;
  if (jsonLeakPattern.test(content.trim())) {
    issues.push({
      type: 'raw_json_leakage',
      message: 'Response contains raw JSON tool output',
    });
  }

  // 4. Stack trace leakage
  if (
    content.includes('Error: ') &&
    content.includes(' at ') &&
    content.includes('.ts:')
  ) {
    issues.push({
      type: 'stack_trace_leakage',
      message: 'Response contains error stack trace',
    });
  }

  // 5. Hallucinated numbers — only check when we have source data
  if (businessState) {
    const hallucinationCheck = checkForHallucinatedNumbers(content, businessState);
    if (hallucinationCheck.hallucinatedNumbers.length > 0) {
      issues.push({
        type: 'hallucinated_number',
        message: `Response contains numbers not found in source data: ${hallucinationCheck.hallucinatedNumbers.join(', ')}`,
        values: hallucinationCheck.hallucinatedNumbers,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Fallback response builder
// ---------------------------------------------------------------------------

/**
 * Produce a safe fallback response when validation fails.
 * Returns empty string if the issues are non-critical (response still usable).
 */
export function buildFallbackResponse(issues: ValidationIssue[]): string {
  const types = new Set(issues.map((i) => i.type));

  if (types.has('empty_response')) {
    return "I wasn't able to generate a response. Could you try rephrasing your question?";
  }
  if (types.has('raw_json_leakage') || types.has('stack_trace_leakage')) {
    return 'I encountered an issue processing your request. Please try again.';
  }
  // too_short_for_task_type — let it through; may still be valid
  // hallucinated_number — handled by disclaimer injection below
  return '';
}

// ---------------------------------------------------------------------------
// Hallucination disclaimer
// ---------------------------------------------------------------------------

const HALLUCINATION_DISCLAIMER =
  '\n\n---\n⚠️ *Some numbers in this response could not be verified against your workspace data. Please double-check any figures before acting on them.*';

/**
 * If hallucinated numbers were detected, append a disclaimer to the response
 * rather than replacing it entirely (the rest of the response may still be
 * valuable).
 */
export function applyHallucinationDisclaimer(
  content: string,
  issues: ValidationIssue[],
): string {
  const hasHallucination = issues.some((i) => i.type === 'hallucinated_number');
  if (!hasHallucination) return content;
  return content + HALLUCINATION_DISCLAIMER;
}

// ---------------------------------------------------------------------------
// Violation logging (quality monitoring)
// ---------------------------------------------------------------------------

export interface ValidationViolationLog {
  timestamp: string;
  taskType: TaskType;
  issues: ValidationIssue[];
  /** Truncated response snippet for debugging */
  responseSnippet: string;
}

/**
 * Log validation violations for quality monitoring.
 * Currently logs to console; can be extended to write to a database table.
 */
export function logValidationViolations(
  taskType: TaskType,
  issues: ValidationIssue[],
  response: string,
): void {
  if (issues.length === 0) return;

  const log: ValidationViolationLog = {
    timestamp: new Date().toISOString(),
    taskType,
    issues,
    responseSnippet: response.slice(0, 200),
  };

  console.warn('[response-validator] Validation violation:', JSON.stringify(log));
}

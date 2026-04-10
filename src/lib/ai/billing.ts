// ---------------------------------------------------------------------------
// Insufficient credits check
// ---------------------------------------------------------------------------

export interface InsufficientCreditsError {
  type: 'insufficient_credits';
  required: number;
  available: number;
  message: string;
}

/**
 * Check whether a workspace has enough credits for the given task.
 * Returns null if sufficient, or an error object if not.
 */
export function checkSufficientCredits(
  balance: number,
  creditCost: number,
): InsufficientCreditsError | null {
  if (balance >= creditCost) {
    return null;
  }

  return {
    type: 'insufficient_credits',
    required: creditCost,
    available: balance,
    message:
      'You have insufficient credits to process this request. Please upgrade your plan or purchase additional credits.',
  };
}

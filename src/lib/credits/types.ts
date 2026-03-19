// Credit service types — used by credit-service.ts and consumers

export type CreditTransactionType = 'purchase' | 'bonus' | 'refund' | 'monthly_reset';

export interface DeductResult {
  success: boolean;
  error?: string;
  transaction_id?: string;
  balance?: number;
  deducted?: number;
  required?: number;
}

export interface AddResult {
  success: boolean;
  error?: string;
  transaction_id?: string;
  balance?: number;
  added?: number;
}

export interface MemberUsage {
  user_id: string;
  total_credits_used: number;
  transaction_count: number;
}

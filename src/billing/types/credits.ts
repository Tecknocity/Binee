export interface UserCreditAccount {
  id: string;
  user_id: string;
  subscription_balance: number;       // exact decimal (e.g., 87.4523)
  subscription_plan_credits: number;  // how many credits the plan gives per allocation
  paygo_balance: number;              // exact decimal, never expires
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: 'signup_bonus' | 'subscription_renewal' | 'subscription_upgrade' | 'paygo_purchase' | 'setup_purchase';
  credits_added: number;
  pool: 'subscription' | 'paygo';
  amount_paid_cents: number;
  description: string;
  created_at: string;
}

export interface CreditUsage {
  id: string;
  user_id: string;
  action_type: 'chat' | 'health_check' | 'setup' | 'dashboard' | 'briefing';
  session_id: string;
  model_used: 'haiku' | 'sonnet' | 'opus';
  input_tokens: number;
  output_tokens: number;
  anthropic_cost_cents: number;
  credits_deducted: number;
  deducted_from_subscription: number;
  deducted_from_paygo: number;
  created_at: string;
}

// Display balance = Math.floor(subscription_balance + paygo_balance)
export function getDisplayBalance(account: UserCreditAccount): number {
  return Math.floor(account.subscription_balance + account.paygo_balance);
}

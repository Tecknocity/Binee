// ---- Credit Economics ----
export const CREDIT_COST_VALUE = 0.02;  // 1 credit = $0.02 of our cost (baseline)

export const MARKUP_MULTIPLIERS = {
  annual: 5,    // user pays $0.10/credit, our cost $0.02
  monthly: 6,   // user pays $0.12/credit, our cost $0.02
  paygo: 7,     // user pays $0.14/credit, our cost $0.02
} as const;

// ---- Anthropic Rates ($ per million tokens) ----
// Update these when Anthropic changes pricing
export const ANTHROPIC_RATES = {
  haiku:  { input: 1.00, output: 5.00 },
  sonnet: { input: 3.00, output: 15.00 },
  opus:   { input: 5.00, output: 25.00 },
} as const;

// ---- Subscription Tiers ----
export const PLAN_TIERS = {
  '100':  { credits: 100,  monthlyPrice: 1200,  annualMonthlyPrice: 1000 },  // cents
  '150':  { credits: 150,  monthlyPrice: 1800,  annualMonthlyPrice: 1500 },
  '250':  { credits: 250,  monthlyPrice: 3000,  annualMonthlyPrice: 2500 },
  '500':  { credits: 500,  monthlyPrice: 6000,  annualMonthlyPrice: 5000 },
  '750':  { credits: 750,  monthlyPrice: 9000,  annualMonthlyPrice: 7500 },
  '1000': { credits: 1000, monthlyPrice: 12000, annualMonthlyPrice: 10000 },
  '2000': { credits: 2000, monthlyPrice: 24000, annualMonthlyPrice: 20000 },
} as const;

// ---- Free Tier ----
export const FREE_SIGNUP_CREDITS = 25;  // One-time, lands in PAYG pool

// ---- Setup ----
export const SETUP_FEE_CENTS = 2500;    // $25
export const SETUP_CREDITS = Math.floor(SETUP_FEE_CENTS / 14); // ~178 PAYG credits

// ---- PAYG ----
export const PAYGO_PRICE_PER_CREDIT_CENTS = 14; // $0.14/credit
export const PAYGO_MIN_PURCHASE_CENTS = 100;     // $1 minimum

// ---- Warning Thresholds ----
export const WARNING_THRESHOLDS = {
  low: 50,       // ≤50 credits: "You have X credits remaining"
  critical: 20,  // ≤20 credits: "You're almost out of credits"
  empty: 0,      // 0 credits: "You've used all your credits"
} as const;

// ---- Allocation ----
export const CREDIT_ALLOCATION_INTERVAL_DAYS = 30;  // Monthly credit drip for all plans

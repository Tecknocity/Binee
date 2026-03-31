// ---- Flat Credit Tiers (decoupled from Anthropic tokens) ----
// Classification happens AFTER message processing based on what sub-agents were called.
export const MESSAGE_CREDIT_TIERS = {
  simple: 0.55,   // Master answers alone, no sub-agents
  standard: 0.70, // 1 sub-agent called
  complex: 1.00,  // 2+ sub-agents or Setupper
} as const;

export type MessageTier = keyof typeof MESSAGE_CREDIT_TIERS;

// ---- Anthropic Rates ($ per million tokens) — for ANALYTICS only, not billing ----
export const ANTHROPIC_RATES = {
  haiku:  { input: 0.80, output: 4.00 },
  sonnet: { input: 3.00, output: 15.00 },
} as const;

// ---- Subscription Tiers ----
// All monthly prices = $0.12/credit. Annual prices = ~10% discount.
export const PLAN_TIERS = {
  '100':  { credits: 100,  monthlyPrice: 1200,  annualMonthlyPrice: 1125 },  // annual: $135/yr
  '150':  { credits: 150,  monthlyPrice: 1800,  annualMonthlyPrice: 1658 },  // annual: $199/yr
  '250':  { credits: 250,  monthlyPrice: 3000,  annualMonthlyPrice: 2775 },  // annual: $333/yr
  '500':  { credits: 500,  monthlyPrice: 6000,  annualMonthlyPrice: 5625 },  // annual: $675/yr
  '750':  { credits: 750,  monthlyPrice: 9000,  annualMonthlyPrice: 8250 },  // annual: $990/yr
  '1000': { credits: 1000, monthlyPrice: 12000, annualMonthlyPrice: 11250 }, // annual: $1,350/yr
  '2000': { credits: 2000, monthlyPrice: 24000, annualMonthlyPrice: 22333 }, // annual: $2,680/yr
} as const;

export type PlanTier = keyof typeof PLAN_TIERS;

// ---- Free Tier ----
export const FREE_SIGNUP_CREDITS = 25;  // One-time, lands in PAYG pool

// ---- Setup ----
export const SETUP_FEE_CENTS = 2500;    // $25
export const SETUP_CREDITS = Math.floor(SETUP_FEE_CENTS / 14); // 178 PAYG credits

// ---- PAYG ----
export const PAYGO_PRICE_PER_CREDIT_CENTS = 14; // $0.14/credit
export const PAYGO_MIN_PURCHASE_CENTS = 100;     // $1 minimum

// ---- Warning Thresholds ----
export const WARNING_THRESHOLDS = {
  low: 50,
  critical: 20,
  empty: 0,
} as const;

// ---- Allocation ----
export const CREDIT_ALLOCATION_INTERVAL_DAYS = 30;

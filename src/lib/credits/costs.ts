// Centralized credit cost constants for all billable actions

export const CREDIT_COSTS = {
  SIMPLE_CHAT: 1,        // Haiku query
  COMPLEX_CHAT: 3,       // Sonnet query
  STRATEGIC_CHAT: 5,     // Complex Sonnet query
  DASHBOARD_WIDGET: 2,   // Creating a new widget
  HEALTH_CHECK_CHAT: 1,  // Health summary in chat
  SETUP_PLANNING: 10,    // Full workspace setup plan
  SETUP_EXECUTION: 5,    // Executing the setup
} as const;

export type CreditCostKey = keyof typeof CREDIT_COSTS;

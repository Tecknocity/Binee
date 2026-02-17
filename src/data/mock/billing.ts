export interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  pdfUrl: string;
}

export interface PaymentMethod {
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}

export interface BillingInfo {
  plan: 'free' | 'pro' | 'enterprise';
  price: number;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: string;
  paymentMethod: PaymentMethod;
  invoices: Invoice[];
}

export const mockBilling: BillingInfo = {
  plan: 'pro' as const,
  price: 49,
  billingCycle: 'monthly' as const,
  nextBillingDate: '2026-03-16',
  paymentMethod: {
    brand: 'Visa',
    last4: '4242',
    expiryMonth: 12,
    expiryYear: 2027,
  },
  invoices: [
    {
      id: 'inv_5',
      date: '2026-02-16',
      amount: 49,
      status: 'pending',
      pdfUrl: '/invoices/inv_5.pdf',
    },
    {
      id: 'inv_4',
      date: '2026-01-16',
      amount: 49,
      status: 'paid',
      pdfUrl: '/invoices/inv_4.pdf',
    },
    {
      id: 'inv_3',
      date: '2025-12-16',
      amount: 49,
      status: 'paid',
      pdfUrl: '/invoices/inv_3.pdf',
    },
    {
      id: 'inv_2',
      date: '2025-11-16',
      amount: 49,
      status: 'paid',
      pdfUrl: '/invoices/inv_2.pdf',
    },
    {
      id: 'inv_1',
      date: '2025-10-16',
      amount: 49,
      status: 'paid',
      pdfUrl: '/invoices/inv_1.pdf',
    },
  ],
};

export interface Plan {
  name: string;
  price: number | null;
  billing: string;
  features: string[];
  popular?: boolean;
}

export const plans: Plan[] = [
  {
    name: 'Free',
    price: 0,
    billing: 'forever',
    features: [
      '2 integrations',
      'Basic dashboards',
      '7-day data history',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    price: 49,
    billing: '/month',
    features: [
      '10 integrations',
      'AI intelligence',
      'Unlimited history',
      'Email support',
      'Goals & suggestions',
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: null,
    billing: 'Custom',
    features: [
      'Unlimited integrations',
      'Custom playbooks',
      'Dedicated support',
      'API access',
      'Team features',
    ],
  },
];

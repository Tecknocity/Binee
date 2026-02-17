import React, { useState } from 'react';
import { PageLayout } from '../components/Layout';
import {
  CreditCard,
  Download,
  Check,
  Crown,
  Building2,
  Zap,
  BarChart3,
  Brain,
  ArrowRight,
} from 'lucide-react';
import { Progress } from '../components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: PlanFeature[];
  current: boolean;
  highlight?: boolean;
  icon: React.ReactNode;
  cta: string;
}

interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: 'paid' | 'pending' | 'failed';
}

interface UsageMetric {
  label: string;
  used: number;
  total: number;
  icon: React.ReactNode;
  color: string;
  format?: (n: number) => string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'For individuals getting started',
    icon: <Zap size={20} />,
    current: false,
    cta: 'Downgrade',
    features: [
      { text: '2 integrations', included: true },
      { text: 'Basic dashboards', included: true },
      { text: '7-day data history', included: true },
      { text: 'Community support', included: true },
      { text: 'AI intelligence', included: false },
      { text: 'Goals & suggestions', included: false },
    ],
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For growing businesses',
    icon: <Crown size={20} />,
    current: true,
    highlight: true,
    cta: 'Current Plan',
    features: [
      { text: '10 integrations', included: true },
      { text: 'AI intelligence', included: true },
      { text: 'Unlimited data history', included: true },
      { text: 'Email support', included: true },
      { text: 'Goals & suggestions', included: true },
      { text: 'Advanced dashboards', included: true },
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: ' pricing',
    description: 'For large-scale operations',
    icon: <Building2 size={20} />,
    current: false,
    cta: 'Contact Sales',
    features: [
      { text: 'Unlimited integrations', included: true },
      { text: 'Custom playbooks', included: true },
      { text: 'Dedicated support', included: true },
      { text: 'API access', included: true },
      { text: 'Team features', included: true },
      { text: 'SSO & advanced security', included: true },
    ],
  },
];

const INVOICES: Invoice[] = [
  {
    id: 'INV-2026-005',
    date: 'Feb 16, 2026',
    description: 'Pro Plan - Monthly',
    amount: '$49.00',
    status: 'paid',
  },
  {
    id: 'INV-2026-004',
    date: 'Jan 16, 2026',
    description: 'Pro Plan - Monthly',
    amount: '$49.00',
    status: 'paid',
  },
  {
    id: 'INV-2025-003',
    date: 'Dec 16, 2025',
    description: 'Pro Plan - Monthly',
    amount: '$49.00',
    status: 'paid',
  },
  {
    id: 'INV-2025-002',
    date: 'Nov 16, 2025',
    description: 'Pro Plan - Monthly',
    amount: '$49.00',
    status: 'paid',
  },
  {
    id: 'INV-2025-001',
    date: 'Oct 16, 2025',
    description: 'Pro Plan - Monthly',
    amount: '$49.00',
    status: 'pending',
  },
];

const USAGE_METRICS: UsageMetric[] = [
  {
    label: 'Integrations connected',
    used: 4,
    total: 10,
    icon: <Zap size={18} className="text-primary" />,
    color: 'bg-primary/10',
  },
  {
    label: 'Data syncs this month',
    used: 1247,
    total: 10000,
    icon: <BarChart3 size={18} className="text-accent" />,
    color: 'bg-accent/10',
    format: (n: number) => n.toLocaleString(),
  },
  {
    label: 'AI queries this month',
    used: 38,
    total: 500,
    icon: <Brain size={18} className="text-success" />,
    color: 'bg-success/10',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeClasses(status: Invoice['status']): string {
  switch (status) {
    case 'paid':
      return 'bg-success/15 text-success';
    case 'pending':
      return 'bg-warning/15 text-warning';
    case 'failed':
      return 'bg-destructive/15 text-destructive';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BillingPage: React.FC = () => {
  const [showPlans, setShowPlans] = useState(false);

  // ---- Handlers -----------------------------------------------------------

  const handleChangePlan = () => {
    setShowPlans((prev) => !prev);
  };

  const handleSelectPlan = (plan: Plan) => {
    if (plan.current) return;
    if (plan.name === 'Enterprise') {
      toast.info('Our sales team will reach out to you shortly.');
    } else if (plan.name === 'Free') {
      toast('Are you sure? You will lose access to Pro features.', {
        action: {
          label: 'Confirm downgrade',
          onClick: () => toast.success('Plan changed to Free.'),
        },
      });
    } else {
      toast.success(`Switched to the ${plan.name} plan.`);
    }
  };

  const handleCancelSubscription = () => {
    toast('Your subscription will remain active until March 16, 2026.', {
      description: 'You can reactivate anytime before then.',
    });
  };

  const handleUpdatePayment = () => {
    toast.info('Redirecting to secure payment portal...');
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    toast.success(`Downloading invoice ${invoice.id}...`);
  };

  // ---- Render -------------------------------------------------------------

  return (
    <PageLayout title="Billing" subtitle="Manage your subscription, usage, and payment methods">
      <div className="max-w-[960px] space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* Current Plan Card                                                */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Left: plan info */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 gradient-primary text-white text-xs font-semibold px-3 py-1 rounded-full">
                  <Crown size={14} />
                  Pro Plan
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold gradient-text">$49</span>
                <span className="text-lg text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Billed monthly &middot; Next billing: <span className="text-foreground font-medium">March 16, 2026</span>
              </p>
            </div>

            {/* Right: actions */}
            <div className="flex flex-col items-start sm:items-end gap-2">
              <button
                onClick={handleChangePlan}
                className="gradient-primary text-white px-4 py-2 rounded-lg font-medium text-sm transition-all hover:opacity-90 active:scale-[0.98]"
              >
                {showPlans ? 'Hide Plans' : 'Change Plan'}
              </button>
              <button
                onClick={handleCancelSubscription}
                className="text-muted-foreground text-sm hover:text-foreground transition-colors"
              >
                Cancel Subscription
              </button>
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Plan Comparison (toggled)                                       */}
          {/* -------------------------------------------------------------- */}
          {showPlans && (
            <div className="mt-8 pt-8 border-t border-border animate-fade-in">
              <h3 className="text-lg font-semibold mb-6">Compare Plans</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {PLANS.map((plan) => {
                  const isCurrent = plan.current;
                  return (
                    <div
                      key={plan.name}
                      className={`relative rounded-xl p-5 flex flex-col transition-all ${
                        isCurrent
                          ? 'bg-card ring-2 ring-primary shadow-lg glow-primary'
                          : 'bg-background border border-border hover:border-primary/40'
                      }`}
                    >
                      {/* Current badge */}
                      {isCurrent && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 gradient-primary text-white text-[11px] font-semibold px-3 py-0.5 rounded-full shadow">
                          Current Plan
                        </span>
                      )}

                      {/* Icon + Name */}
                      <div className="flex items-center gap-2 mb-3 mt-1">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isCurrent ? 'gradient-primary text-white' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {plan.icon}
                        </div>
                        <h4 className="text-base font-bold">{plan.name}</h4>
                      </div>

                      {/* Price */}
                      <div className="flex items-baseline gap-0.5 mb-1">
                        <span className="text-2xl font-bold">{plan.price}</span>
                        <span className="text-sm text-muted-foreground">{plan.period}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-5">{plan.description}</p>

                      {/* Features */}
                      <ul className="space-y-2.5 mb-6 flex-1">
                        {plan.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Check
                              size={15}
                              className={`mt-0.5 shrink-0 ${
                                feat.included ? 'text-success' : 'text-muted-foreground/40'
                              }`}
                            />
                            <span
                              className={feat.included ? 'text-foreground' : 'text-muted-foreground/50 line-through'}
                            >
                              {feat.text}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      {isCurrent ? (
                        <div className="gradient-primary text-white text-center text-sm font-medium py-2 rounded-lg opacity-60 cursor-default select-none">
                          Current Plan
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSelectPlan(plan)}
                          className="flex items-center justify-center gap-1.5 border border-border text-foreground text-sm font-medium py-2 rounded-lg hover:bg-muted transition-colors active:scale-[0.98]"
                        >
                          {plan.cta}
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Usage Section                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-bold mb-6">Usage This Period</h2>

          <div className="space-y-6">
            {USAGE_METRICS.map((metric) => {
              const pct = Math.round((metric.used / metric.total) * 100);
              const fmt = metric.format || ((n: number) => String(n));
              return (
                <div key={metric.label}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${metric.color}`}
                      >
                        {metric.icon}
                      </div>
                      <span className="text-sm font-medium">{metric.label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      <span className="text-foreground font-semibold">{fmt(metric.used)}</span>{' '}
                      of {fmt(metric.total)}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2 bg-secondary" />
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Payment Method                                                   */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-8 rounded-md bg-muted border border-border flex items-center justify-center">
                <CreditCard size={20} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">Visa ending in 4242</p>
                <p className="text-xs text-muted-foreground">Expires 12/2027</p>
              </div>
            </div>

            <button
              onClick={handleUpdatePayment}
              className="border border-border text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors active:scale-[0.98]"
            >
              Update payment method
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Billing History                                                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-bold mb-6">Billing History</h2>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {INVOICES.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.date}</TableCell>
                  <TableCell>{invoice.description}</TableCell>
                  <TableCell>{invoice.amount}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadgeClasses(
                        invoice.status,
                      )}`}
                    >
                      {invoice.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={() => handleDownloadInvoice(invoice)}
                      className="inline-flex items-center gap-1 text-primary text-sm hover:underline transition-colors"
                    >
                      <Download size={14} />
                      PDF
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageLayout>
  );
};

export default BillingPage;

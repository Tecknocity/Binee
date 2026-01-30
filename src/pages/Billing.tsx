import React, { useState } from 'react';
import { PageLayout } from '../components/Layout';
import { theme } from '../styles/theme';
import {
  CreditCard,
  Download,
  ExternalLink,
  Zap,
  Users,
  Activity,
  Puzzle,
  Check,
  ArrowUpRight,
} from 'lucide-react';
import { Progress } from '../components/ui/progress';

interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: 'paid' | 'pending' | 'failed';
}

interface Plan {
  name: string;
  price: string;
  period: string;
  features: string[];
  current: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    features: ['Up to 3 integrations', '1,000 API calls/month', 'Basic analytics', 'Email support'],
    current: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    features: [
      'Up to 10 integrations',
      '50,000 API calls/month',
      'Advanced analytics',
      'Priority support',
      'Custom dashboards',
    ],
    current: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: [
      'Unlimited integrations',
      'Unlimited API calls',
      'White-label options',
      'Dedicated support',
      'SLA guarantees',
      'SSO & advanced security',
    ],
    current: false,
  },
];

const INVOICES: Invoice[] = [
  {
    id: 'INV-2024-001',
    date: 'Jan 1, 2024',
    description: 'Pro Plan - Monthly',
    amount: '$29.00',
    status: 'paid',
  },
  {
    id: 'INV-2023-012',
    date: 'Dec 1, 2023',
    description: 'Pro Plan - Monthly',
    amount: '$29.00',
    status: 'paid',
  },
  {
    id: 'INV-2023-011',
    date: 'Nov 1, 2023',
    description: 'Pro Plan - Monthly',
    amount: '$29.00',
    status: 'paid',
  },
  {
    id: 'INV-2023-010',
    date: 'Oct 1, 2023',
    description: 'Pro Plan - Monthly',
    amount: '$29.00',
    status: 'paid',
  },
  {
    id: 'INV-2023-009',
    date: 'Sep 1, 2023',
    description: 'Pro Plan - Monthly',
    amount: '$29.00',
    status: 'paid',
  },
];

const Billing: React.FC = () => {
  const [showPlans, setShowPlans] = useState(false);

  const currentPlan = PLANS.find((p) => p.current);

  const usageData = {
    integrations: { used: 4, total: 10 },
    apiCalls: { used: 23500, total: 50000 },
    teamMembers: { used: 3, total: 5 },
  };

  const handleUpgradePlan = () => {
    setShowPlans(!showPlans);
  };

  const handleSelectPlan = (planName: string) => {
    if (planName === 'Enterprise') {
      alert('Contact sales for Enterprise pricing');
    } else {
      alert(`Switching to ${planName} plan...`);
    }
  };

  const handleUpdatePayment = () => {
    alert('Redirecting to payment method update...');
  };

  const handleDownloadInvoice = (invoiceId: string) => {
    alert(`Downloading invoice ${invoiceId}...`);
  };

  const cardStyle: React.CSSProperties = {
    background: theme.colors.cardBgSolid,
    borderRadius: theme.borderRadius['2xl'],
    border: theme.colors.cardBorder,
    padding: theme.spacing['2xl'],
    marginBottom: theme.spacing.xl,
  };

  const buttonStyle: React.CSSProperties = {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    background: theme.colors.gradient,
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: `all ${theme.transitions.normal}`,
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: 'transparent',
    border: `1px solid ${theme.colors.mutedBorder}`,
    color: theme.colors.textSecondary,
  };

  return (
    <PageLayout title="Billing" subtitle="Manage your subscription and payment methods">
      <div style={{ maxWidth: '900px' }}>
        {/* Current Plan Card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  marginBottom: theme.spacing.lg,
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: theme.borderRadius.xl,
                    background: theme.colors.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Zap size={24} color={theme.colors.text} />
                </div>
                <div>
                  <h2 style={{ fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.bold }}>
                    {currentPlan?.name} Plan
                  </h2>
                  <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>
                    Your current subscription
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.spacing.xs }}>
                <span
                  style={{
                    fontSize: theme.fontSize['7xl'],
                    fontWeight: theme.fontWeight.bold,
                    background: theme.colors.gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {currentPlan?.price}
                </span>
                <span style={{ fontSize: theme.fontSize.lg, color: theme.colors.textSecondary }}>
                  {currentPlan?.period}
                </span>
              </div>

              <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginTop: theme.spacing.md }}>
                Next renewal: February 1, 2024
              </p>
            </div>

            <button style={buttonStyle} onClick={handleUpgradePlan}>
              {showPlans ? 'Hide Plans' : 'Change Plan'}
            </button>
          </div>

          {/* Plan Selection */}
          {showPlans && (
            <div
              style={{
                marginTop: theme.spacing['2xl'],
                paddingTop: theme.spacing['2xl'],
                borderTop: `1px solid ${theme.colors.mutedBorder}`,
              }}
            >
              <h3
                style={{
                  fontSize: theme.fontSize.lg,
                  fontWeight: theme.fontWeight.semibold,
                  marginBottom: theme.spacing.xl,
                }}
              >
                Available Plans
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: theme.spacing.xl }}>
                {PLANS.map((plan) => (
                  <div
                    key={plan.name}
                    style={{
                      background: plan.current ? theme.colors.primaryLight : theme.colors.dark,
                      border: `1px solid ${plan.current ? theme.colors.primary : theme.colors.mutedBorder}`,
                      borderRadius: theme.borderRadius.xl,
                      padding: theme.spacing.xl,
                      position: 'relative',
                    }}
                  >
                    {plan.current && (
                      <div
                        style={{
                          position: 'absolute',
                          top: theme.spacing.md,
                          right: theme.spacing.md,
                          padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                          background: theme.colors.primary,
                          borderRadius: theme.borderRadius.md,
                          fontSize: theme.fontSize.xs,
                          fontWeight: theme.fontWeight.semibold,
                        }}
                      >
                        Current
                      </div>
                    )}
                    <h4
                      style={{
                        fontSize: theme.fontSize.xl,
                        fontWeight: theme.fontWeight.bold,
                        marginBottom: theme.spacing.sm,
                      }}
                    >
                      {plan.name}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.spacing.xs, marginBottom: theme.spacing.lg }}>
                      <span style={{ fontSize: theme.fontSize['3xl'], fontWeight: theme.fontWeight.bold }}>
                        {plan.price}
                      </span>
                      <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.textSecondary }}>
                        {plan.period}
                      </span>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: theme.spacing.xl }}>
                      {plan.features.map((feature, index) => (
                        <li
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: theme.spacing.sm,
                            fontSize: theme.fontSize.sm,
                            color: theme.colors.textSecondary,
                            marginBottom: theme.spacing.sm,
                          }}
                        >
                          <Check size={14} color={theme.colors.success} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {!plan.current && (
                      <button
                        style={{
                          ...secondaryButtonStyle,
                          width: '100%',
                        }}
                        onClick={() => handleSelectPlan(plan.name)}
                      >
                        {plan.name === 'Enterprise' ? 'Contact Sales' : 'Select Plan'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Usage Section */}
        <div style={cardStyle}>
          <h2
            style={{
              fontSize: theme.fontSize.xl,
              fontWeight: theme.fontWeight.bold,
              marginBottom: theme.spacing.xl,
            }}
          >
            Current Usage
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing['2xl'] }}>
            {/* Integrations */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: theme.borderRadius.lg,
                      background: theme.colors.primaryLight,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Puzzle size={18} color={theme.colors.primary} />
                  </div>
                  <span style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.medium }}>
                    Integrations Connected
                  </span>
                </div>
                <span style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>
                  {usageData.integrations.used} of {usageData.integrations.total}
                </span>
              </div>
              <Progress
                value={(usageData.integrations.used / usageData.integrations.total) * 100}
                className="h-2 bg-slate-700"
              />
            </div>

            {/* API Calls */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: theme.borderRadius.lg,
                      background: theme.colors.accentLight,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Activity size={18} color={theme.colors.accent} />
                  </div>
                  <span style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.medium }}>
                    API Calls This Month
                  </span>
                </div>
                <span style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>
                  {usageData.apiCalls.used.toLocaleString()} of {usageData.apiCalls.total.toLocaleString()}
                </span>
              </div>
              <Progress
                value={(usageData.apiCalls.used / usageData.apiCalls.total) * 100}
                className="h-2 bg-slate-700"
              />
            </div>

            {/* Team Members */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: theme.borderRadius.lg,
                      background: theme.colors.successLight,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Users size={18} color={theme.colors.success} />
                  </div>
                  <span style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.medium }}>
                    Team Members
                  </span>
                </div>
                <span style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>
                  {usageData.teamMembers.used} of {usageData.teamMembers.total}
                </span>
              </div>
              <Progress
                value={(usageData.teamMembers.used / usageData.teamMembers.total) * 100}
                className="h-2 bg-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xl }}>
              <div
                style={{
                  width: '56px',
                  height: '36px',
                  borderRadius: theme.borderRadius.md,
                  background: theme.colors.dark,
                  border: `1px solid ${theme.colors.mutedBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CreditCard size={24} color={theme.colors.textSecondary} />
              </div>
              <div>
                <h3
                  style={{
                    fontSize: theme.fontSize.lg,
                    fontWeight: theme.fontWeight.semibold,
                    marginBottom: theme.spacing.xs,
                  }}
                >
                  Payment Method
                </h3>
                <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>
                  Visa ending in ****4242
                </p>
                <p style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted }}>
                  Expires 12/2025
                </p>
              </div>
            </div>
            <button style={secondaryButtonStyle} onClick={handleUpdatePayment}>
              Update
            </button>
          </div>
        </div>

        {/* Billing History */}
        <div style={cardStyle}>
          <h2
            style={{
              fontSize: theme.fontSize.xl,
              fontWeight: theme.fontWeight.bold,
              marginBottom: theme.spacing.xl,
            }}
          >
            Billing History
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                      borderBottom: `1px solid ${theme.colors.mutedBorder}`,
                      fontSize: theme.fontSize.sm,
                      fontWeight: theme.fontWeight.semibold,
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    Date
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                      borderBottom: `1px solid ${theme.colors.mutedBorder}`,
                      fontSize: theme.fontSize.sm,
                      fontWeight: theme.fontWeight.semibold,
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    Description
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                      borderBottom: `1px solid ${theme.colors.mutedBorder}`,
                      fontSize: theme.fontSize.sm,
                      fontWeight: theme.fontWeight.semibold,
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    Amount
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                      borderBottom: `1px solid ${theme.colors.mutedBorder}`,
                      fontSize: theme.fontSize.sm,
                      fontWeight: theme.fontWeight.semibold,
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                      borderBottom: `1px solid ${theme.colors.mutedBorder}`,
                      fontSize: theme.fontSize.sm,
                      fontWeight: theme.fontWeight.semibold,
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    Invoice
                  </th>
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((invoice) => (
                  <tr key={invoice.id}>
                    <td
                      style={{
                        padding: `${theme.spacing.lg} ${theme.spacing.lg}`,
                        borderBottom: `1px solid ${theme.colors.mutedBorder}`,
                        fontSize: theme.fontSize.base,
                        color: theme.colors.text,
                      }}
                    >
                      {invoice.date}
                    </td>
                    <td
                      style={{
                        padding: `${theme.spacing.lg} ${theme.spacing.lg}`,
                        borderBottom: `1px solid ${theme.colors.mutedBorder}`,
                        fontSize: theme.fontSize.base,
                        color: theme.colors.text,
                      }}
                    >
                      {invoice.description}
                    </td>
                    <td
                      style={{
                        padding: `${theme.spacing.lg} ${theme.spacing.lg}`,
                        borderBottom: `1px solid ${theme.colors.mutedBorder}`,
                        fontSize: theme.fontSize.base,
                        fontWeight: theme.fontWeight.medium,
                        color: theme.colors.text,
                      }}
                    >
                      {invoice.amount}
                    </td>
                    <td
                      style={{
                        padding: `${theme.spacing.lg} ${theme.spacing.lg}`,
                        borderBottom: `1px solid ${theme.colors.mutedBorder}`,
                      }}
                    >
                      <span
                        style={{
                          padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                          background:
                            invoice.status === 'paid'
                              ? theme.colors.successLight
                              : invoice.status === 'pending'
                              ? theme.colors.warningLight
                              : theme.colors.dangerLight,
                          border: `1px solid ${
                            invoice.status === 'paid'
                              ? theme.colors.successBorder
                              : invoice.status === 'pending'
                              ? theme.colors.warningBorder
                              : theme.colors.dangerBorder
                          }`,
                          borderRadius: theme.borderRadius.md,
                          color:
                            invoice.status === 'paid'
                              ? theme.colors.success
                              : invoice.status === 'pending'
                              ? theme.colors.warning
                              : theme.colors.danger,
                          fontSize: theme.fontSize.xs,
                          fontWeight: theme.fontWeight.semibold,
                          textTransform: 'capitalize',
                        }}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: `${theme.spacing.lg} ${theme.spacing.lg}`,
                        borderBottom: `1px solid ${theme.colors.mutedBorder}`,
                        textAlign: 'right',
                      }}
                    >
                      <button
                        onClick={() => handleDownloadInvoice(invoice.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: theme.colors.primary,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: theme.spacing.xs,
                          fontSize: theme.fontSize.sm,
                        }}
                      >
                        <Download size={14} />
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Billing;

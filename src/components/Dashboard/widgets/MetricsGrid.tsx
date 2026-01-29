import React from 'react';
import { DollarSign, TrendingUp, Users, Briefcase } from 'lucide-react';
import { Metrics } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';
import { MetricCard } from '../MetricCard';

interface MetricsGridProps {
  metrics: Metrics;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: theme.spacing['xl'] }}>
      <MetricCard title="Cash on Hand" value={`$${(metrics.cash / 1000).toFixed(1)}K`} subtitle="From QuickBooks" icon={DollarSign} color={theme.colors.successLight} topBorder={theme.colors.success} />
      <MetricCard title="Monthly Recurring Revenue" value={`$${(metrics.mrr / 1000).toFixed(0)}K`} subtitle="From Stripe" icon={TrendingUp} color={theme.colors.primaryLight} topBorder={theme.colors.primary} />
      <MetricCard title="Active Customers" value={metrics.customers} subtitle="From HubSpot" icon={Users} color={theme.colors.infoLight} topBorder={theme.colors.info} />
      <MetricCard title="Active Projects" value={metrics.projects} subtitle="From ClickUp" icon={Briefcase} color={theme.colors.accentLight} topBorder={theme.colors.accent} />
    </div>
  );
};

import React from 'react';
import { HighValueDeal } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';

interface HighValueDealsProps {
  deals: HighValueDeal[];
}

export const HighValueDeals: React.FC<HighValueDealsProps> = ({ deals }) => {
  return (
    <div style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
      <h3 style={{ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing['xl'], color: theme.colors.text }}>High-Value Deals</h3>
      <div style={{ display: 'grid', gap: theme.spacing.lg }}>
        {deals.map((deal, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: theme.spacing.lg, padding: theme.spacing.lg, background: theme.colors.cardInner, borderRadius: theme.borderRadius.lg, alignItems: 'center' }}>
            <div><div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>{deal.company}</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, textTransform: 'uppercase' }}>Value</div><div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.success }}>${(deal.value / 1000).toFixed(0)}K</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, textTransform: 'uppercase' }}>Stage</div><div style={{ fontSize: theme.fontSize.base, color: theme.colors.text }}>{deal.stage}</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, textTransform: 'uppercase' }}>Probability</div><div style={{ fontSize: theme.fontSize.base, color: theme.colors.text }}>{deal.probability}%</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, textTransform: 'uppercase' }}>Days in Stage</div><div style={{ fontSize: theme.fontSize.base, color: deal.daysInStage > 14 ? theme.colors.warning : theme.colors.text }}>{deal.daysInStage}</div></div>
            <div style={{ textAlign: 'center' }}><span style={{ padding: `${theme.spacing.xs} ${theme.spacing.md}`, borderRadius: theme.borderRadius.sm, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, background: deal.status === 'Active' ? theme.colors.successLight : theme.colors.warningLight, color: deal.status === 'Active' ? theme.colors.success : theme.colors.warning }}>{deal.status}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
};

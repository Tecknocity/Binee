import React from 'react';
import { Brain } from 'lucide-react';
import { Prediction } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';

interface AIInsightsProps {
  predictions: Prediction[];
}

export const AIInsights: React.FC<AIInsightsProps> = ({ predictions }) => {
  return (
    <div style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing['xl'] }}>
        <Brain size={24} color={theme.colors.accent} />
        <h3 style={{ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>AI Predictions</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
        {predictions.map((pred, i) => (
          <div key={i} style={{ background: theme.colors.cardInner, padding: theme.spacing['xl'], borderRadius: theme.borderRadius.xl }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.md }}>
              <h4 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>{pred.title}</h4>
              <span style={{ padding: `${theme.spacing.xs} ${theme.spacing.md}`, borderRadius: theme.borderRadius.sm, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, background: pred.confidence >= 80 ? theme.colors.successLight : theme.colors.warningLight, color: pred.confidence >= 80 ? theme.colors.success : theme.colors.warning }}>{pred.confidence}% confidence</span>
            </div>
            <div style={{ fontSize: theme.fontSize['4xl'], fontWeight: theme.fontWeight.bold, color: theme.colors.accent, marginBottom: theme.spacing.sm }}>{pred.prediction}</div>
            <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>{pred.details}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

import React from 'react';
import { MetricCardProps } from '../../types/dashboard';
import { theme } from '../../styles/theme';

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon: Icon, color, topBorder }) => {
  return (
    <div style={{ background: theme.colors.cardBgSolid, padding: theme.spacing['xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder, position: 'relative' }}>
      {topBorder && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: topBorder, borderRadius: `${theme.borderRadius['2xl']} ${theme.borderRadius['2xl']} 0 0` }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.lg }}>
        <div style={{ width: '44px', height: '44px', borderRadius: theme.borderRadius.xl, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={theme.colors.text} />
        </div>
      </div>
      <div style={{ fontSize: theme.fontSize['6xl'], fontWeight: theme.fontWeight.bold, color: theme.colors.text, marginBottom: theme.spacing.sm }}>{value}</div>
      <div style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>{title}</div>
      {subtitle && <div style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: theme.spacing.xs }}>{subtitle}</div>}
    </div>
  );
};

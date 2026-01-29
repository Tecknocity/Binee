import React from 'react';
import { TeamMember } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';

interface TeamPerformanceProps {
  data: TeamMember[];
}

export const TeamPerformance: React.FC<TeamPerformanceProps> = ({ data }) => {
  return (
    <div style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
      <h3 style={{ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing['xl'], color: theme.colors.text }}>Team Performance</h3>
      <div style={{ display: 'grid', gap: theme.spacing.lg }}>
        {data.map((member, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.lg, background: theme.colors.cardInner, borderRadius: theme.borderRadius.lg }}>
            <div style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>{member.member}</div>
            <div style={{ display: 'flex', gap: theme.spacing['2xl'] }}>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>Tasks</div><div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.success }}>{member.tasksCompleted}</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary }}>Hours</div><div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.info }}>{member.hoursLogged}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

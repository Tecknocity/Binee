import React from 'react';
import { CapacityUtilization } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';

interface TeamCapacityUtilizationProps {
  data: CapacityUtilization[];
}

const UTILIZATION_COLORS = [theme.colors.danger, theme.colors.warning, theme.colors.warning, theme.colors.success];

export const TeamCapacityUtilization: React.FC<TeamCapacityUtilizationProps> = ({ data }) => {
  return (
    <div style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
      <h3 style={{ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing['xl'], color: theme.colors.text }}>Team Capacity Utilization</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
        {data.map((member, i) => {
          const color = UTILIZATION_COLORS[i] || theme.colors.success;
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
                <span style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>{member.member}</span>
                <span style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, color }}>{member.utilization}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: theme.colors.progressBg, borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${member.utilization}%`, height: '100%', background: color, borderRadius: '4px' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

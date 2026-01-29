import React from 'react';
import { Target, Plus } from 'lucide-react';
import { Goal } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';

interface GoalsTabProps {
  goals: Goal[];
  onAddGoalClick: () => void;
}

export const GoalsTab: React.FC<GoalsTabProps> = ({ goals, onAddGoalClick }) => {
  return (
    <div role="tabpanel" id="goals-panel" aria-labelledby="goals-tab" style={{ display: 'grid', gap: theme.spacing['2xl'] }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          <Target size={28} color={theme.colors.accent} />
          <div>
            <h2 style={{ fontSize: theme.fontSize['4xl'], fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>Business Goals</h2>
            <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>Track progress toward your key objectives</p>
          </div>
        </div>
        <button onClick={onAddGoalClick} style={{ padding: `${theme.spacing.md} ${theme.spacing['xl']}`, background: theme.colors.gradient, border: 'none', color: theme.colors.text, borderRadius: theme.borderRadius.xl, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <Plus size={18} /> Add New Goal
        </button>
      </div>
      <div style={{ display: 'grid', gap: theme.spacing['xl'] }}>
        {goals.map((goal, i) => {
          const progress = (goal.current / goal.target) * 100;
          const isOnTrack = goal.status === 'on-track';
          return (
            <div key={i} style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing['xl'] }}>
                <div>
                  <h3 style={{ fontSize: theme.fontSize['3xl'], fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing.sm }}>{goal.name}</h3>
                  <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>Target: {goal.unit === 'USD' ? `$${(goal.target / 1000).toFixed(0)}K` : `${goal.target} ${goal.unit}`}</p>
                </div>
                <span style={{ padding: `${theme.spacing.sm} ${theme.spacing.lg}`, borderRadius: theme.borderRadius.md, fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.bold, background: isOnTrack ? theme.colors.successLight : theme.colors.warningLight, color: isOnTrack ? theme.colors.success : theme.colors.warning }}>{isOnTrack ? 'ON-TRACK' : 'AT-RISK'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing['2xl'] }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
                    <span style={{ fontSize: theme.fontSize['5xl'], fontWeight: theme.fontWeight.bold, color: theme.colors.text }}>{goal.unit === 'USD' ? `$${(goal.current / 1000).toFixed(0)}K` : goal.current}</span>
                    <span style={{ fontSize: theme.fontSize['3xl'], fontWeight: theme.fontWeight.bold, color: isOnTrack ? theme.colors.success : theme.colors.warning }}>{progress.toFixed(0)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '12px', background: theme.colors.progressBg, borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', background: isOnTrack ? theme.colors.success : theme.colors.warning, borderRadius: '6px', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

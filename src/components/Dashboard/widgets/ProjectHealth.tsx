import React from 'react';
import { Project } from '../../../types/dashboard';
import { theme, statusColors, statusLabels } from '../../../styles/theme';

interface ProjectHealthProps {
  projects: Project[];
}

export const ProjectHealth: React.FC<ProjectHealthProps> = ({ projects }) => {
  return (
    <div style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
      <h3 style={{ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing['xl'], color: theme.colors.text }}>Project Health Status</h3>
      <div style={{ display: 'grid', gap: theme.spacing.lg }}>
        {projects.map((project, i) => {
          const budgetPercent = (project.spent / project.budget) * 100;
          return (
            <div key={i} style={{ background: theme.colors.cardInner, padding: theme.spacing['xl'], borderRadius: theme.borderRadius.xl }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
                <h4 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>{project.name}</h4>
                <span style={{ padding: `${theme.spacing.xs} ${theme.spacing.md}`, borderRadius: theme.borderRadius.sm, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.bold, background: `${statusColors[project.status]}22`, color: statusColors[project.status] }}>{statusLabels[project.status]}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: theme.spacing.lg, marginBottom: theme.spacing.lg }}>
                <div><div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, textTransform: 'uppercase' }}>Progress</div><div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: theme.colors.text }}>{project.progress}%</div></div>
                <div><div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, textTransform: 'uppercase' }}>Budget</div><div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: budgetPercent > 90 ? theme.colors.danger : theme.colors.text }}>${(project.spent / 1000).toFixed(0)}K / ${(project.budget / 1000).toFixed(0)}K</div></div>
                <div><div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, textTransform: 'uppercase' }}>Timeline</div><div style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold, color: project.dueIn < 0 ? theme.colors.danger : theme.colors.text }}>{project.dueIn < 0 ? `${Math.abs(project.dueIn)} days overdue` : `${project.dueIn} days remaining`}</div></div>
              </div>
              <div style={{ width: '100%', height: '8px', background: theme.colors.progressBg, borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${project.progress}%`, height: '100%', background: statusColors[project.status], borderRadius: '4px' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

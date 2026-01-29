import React from 'react';
import { Zap } from 'lucide-react';
import { Suggestion } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';

interface SuggestionsTabProps {
  suggestions: Suggestion[];
}

export const SuggestionsTab: React.FC<SuggestionsTabProps> = ({ suggestions }) => {
  const highPriority = suggestions.filter((s) => s.priority === 'high');
  const mediumPriority = suggestions.filter((s) => s.priority === 'medium');
  const lowPriority = suggestions.filter((s) => s.priority === 'low');

  return (
    <div role="tabpanel" id="suggestions-panel" aria-labelledby="suggestions-tab" style={{ display: 'grid', gap: theme.spacing['2xl'] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
        <Zap size={28} color={theme.colors.accent} />
        <div>
          <h2 style={{ fontSize: theme.fontSize['4xl'], fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>System Improvement Suggestions</h2>
          <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>Recommendations to optimize your business systems</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: theme.spacing['xl'] }}>
        <div style={{ background: theme.colors.cardBg, padding: theme.spacing['xl'], borderRadius: theme.borderRadius['2xl'], border: `1px solid ${theme.colors.dangerBorder}` }}>
          <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: theme.spacing.sm }}>HIGH PRIORITY</div>
          <div style={{ fontSize: theme.fontSize['8xl'], fontWeight: theme.fontWeight.bold, color: theme.colors.danger }}>{highPriority.length}</div>
          <div style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>Quick wins available</div>
        </div>
        <div style={{ background: theme.colors.cardBg, padding: theme.spacing['xl'], borderRadius: theme.borderRadius['2xl'], border: `1px solid ${theme.colors.warningBorder}` }}>
          <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: theme.spacing.sm }}>MEDIUM PRIORITY</div>
          <div style={{ fontSize: theme.fontSize['8xl'], fontWeight: theme.fontWeight.bold, color: theme.colors.warning }}>{mediumPriority.length}</div>
          <div style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>Worth considering</div>
        </div>
        <div style={{ background: theme.colors.cardBg, padding: theme.spacing['xl'], borderRadius: theme.borderRadius['2xl'], border: `1px solid ${theme.colors.infoBorder}` }}>
          <div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: theme.spacing.sm }}>LOW PRIORITY</div>
          <div style={{ fontSize: theme.fontSize['8xl'], fontWeight: theme.fontWeight.bold, color: theme.colors.info }}>{lowPriority.length}</div>
          <div style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>Nice to have</div>
        </div>
      </div>
      {highPriority.map((sug, i) => (
        <div key={i} style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius.xl, border: `1px solid ${theme.colors.dangerBorder}` }}>
          <h4 style={{ fontSize: theme.fontSize['2xl'], fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing.md }}>{sug.title}</h4>
          <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginBottom: theme.spacing.lg, lineHeight: '1.6' }}>{sug.reasoning}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.lg, background: theme.colors.successLight, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.lg }}>
            <div><div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, textTransform: 'uppercase' }}>Impact</div><div style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, color: theme.colors.success }}>{sug.impact}</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, textTransform: 'uppercase' }}>Effort</div><div style={{ fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, color: theme.colors.text }}>{sug.effort}</div></div>
          </div>
          <div style={{ display: 'flex', gap: theme.spacing.md }}>
            <button onClick={() => alert(`Applied: ${sug.title}`)} style={{ flex: 1, padding: theme.spacing.md, background: theme.colors.gradient, border: 'none', color: theme.colors.text, borderRadius: theme.borderRadius.lg, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>Apply</button>
            <button onClick={() => alert('Dismissed')} style={{ padding: `${theme.spacing.md} ${theme.spacing['xl']}`, background: 'transparent', border: `1px solid ${theme.colors.mutedBorder}`, color: theme.colors.textSecondary, borderRadius: theme.borderRadius.lg, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer' }}>Dismiss</button>
          </div>
        </div>
      ))}
      {mediumPriority.map((sug, i) => (
        <div key={i} style={{ background: theme.colors.cardBg, padding: theme.spacing['xl'], borderRadius: theme.borderRadius.xl, border: `1px solid ${theme.colors.warningBorder}` }}>
          <h4 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing.sm }}>{sug.title}</h4>
          <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>{sug.reasoning}</p>
        </div>
      ))}
      {lowPriority.map((sug, i) => (
        <div key={i} style={{ background: theme.colors.cardBg, padding: theme.spacing['xl'], borderRadius: theme.borderRadius.xl, border: `1px solid ${theme.colors.infoBorder}` }}>
          <h4 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing.sm }}>{sug.title}</h4>
          <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>{sug.reasoning}</p>
        </div>
      ))}
    </div>
  );
};

import React from 'react';
import { Brain } from 'lucide-react';
import { MockData, WidgetId } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';
import { WidgetWrapper } from '../WidgetWrapper';
import { AIInsights } from '../widgets/AIInsights';

interface IntelligenceTabProps {
  data: MockData;
  overviewWidgets: WidgetId[];
  onToggleWidget: (widgetId: WidgetId) => void;
}

export const IntelligenceTab: React.FC<IntelligenceTabProps> = ({ data, overviewWidgets, onToggleWidget }) => {
  return (
    <div role="tabpanel" id="intelligence-panel" aria-labelledby="intelligence-tab" style={{ display: 'grid', gap: theme.spacing['2xl'] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
        <Brain size={28} color={theme.colors.accent} />
        <div>
          <h2 style={{ fontSize: theme.fontSize['4xl'], fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>AI Intelligence</h2>
          <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>Predictions and insights powered by AI</p>
        </div>
      </div>
      <WidgetWrapper widgetId="aiInsights" overviewWidgets={overviewWidgets} activeTab="intelligence" onToggle={onToggleWidget}>
        <AIInsights predictions={data.predictions} />
      </WidgetWrapper>
      <div style={{ background: theme.colors.cardBg, padding: theme.spacing['2xl'], borderRadius: theme.borderRadius['2xl'], border: theme.colors.cardBorder }}>
        <h3 style={{ fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing['xl'], color: theme.colors.text }}>How AI Predictions Work</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: theme.spacing['xl'] }}>
          <div style={{ padding: theme.spacing['xl'], background: theme.colors.cardInner, borderRadius: theme.borderRadius.xl }}>
            <div style={{ fontSize: theme.fontSize['6xl'], marginBottom: theme.spacing.md }}>1</div>
            <h4 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing.sm }}>Data Collection</h4>
            <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>We aggregate data from all your connected tools in real-time.</p>
          </div>
          <div style={{ padding: theme.spacing['xl'], background: theme.colors.cardInner, borderRadius: theme.borderRadius.xl }}>
            <div style={{ fontSize: theme.fontSize['6xl'], marginBottom: theme.spacing.md }}>2</div>
            <h4 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing.sm }}>Pattern Analysis</h4>
            <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>AI models identify trends, anomalies, and correlations in your business data.</p>
          </div>
          <div style={{ padding: theme.spacing['xl'], background: theme.colors.cardInner, borderRadius: theme.borderRadius.xl }}>
            <div style={{ fontSize: theme.fontSize['6xl'], marginBottom: theme.spacing.md }}>3</div>
            <h4 style={{ fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing.sm }}>Actionable Insights</h4>
            <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary }}>Receive predictions with confidence scores and recommended actions.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

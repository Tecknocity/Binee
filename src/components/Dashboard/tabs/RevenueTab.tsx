import React from 'react';
import { DollarSign } from 'lucide-react';
import { MockData, ViewMode, WidgetId } from '../../../types/dashboard';
import { theme } from '../../../styles/theme';
import { WidgetWrapper } from '../WidgetWrapper';
import { RevenueTrend } from '../widgets/RevenueTrend';
import { RevenueBySource } from '../widgets/RevenueBySource';
import { ExpenseBreakdown } from '../widgets/ExpenseBreakdown';
import { SalesPipeline } from '../widgets/SalesPipeline';
import { DealCountByStage } from '../widgets/DealCountByStage';
import { HighValueDeals } from '../widgets/HighValueDeals';

interface RevenueTabProps {
  data: MockData;
  viewMode: ViewMode;
  overviewWidgets: WidgetId[];
  onToggleWidget: (widgetId: WidgetId) => void;
}

export const RevenueTab: React.FC<RevenueTabProps> = ({ data, viewMode, overviewWidgets, onToggleWidget }) => {
  const pipelineData = viewMode === 'company' ? data.companyPipeline : data.pipeline;
  const dealCountData = viewMode === 'company' ? data.companyDealCount : data.pipeline;

  return (
    <div role="tabpanel" id="revenue-panel" aria-labelledby="revenue-tab" style={{ display: 'grid', gap: theme.spacing['2xl'] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
        <DollarSign size={28} color={theme.colors.accent} />
        <div>
          <h2 style={{ fontSize: theme.fontSize['4xl'], fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>Revenue & Pipeline</h2>
          <p style={{ fontSize: theme.fontSize.base, color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>Financial performance and sales pipeline analytics</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: theme.spacing['xl'] }}>
        <WidgetWrapper widgetId="revenueTrend" overviewWidgets={overviewWidgets} activeTab="revenue" onToggle={onToggleWidget}>
          <RevenueTrend data={data.revenue} />
        </WidgetWrapper>
        <WidgetWrapper widgetId="revenueBySource" overviewWidgets={overviewWidgets} activeTab="revenue" onToggle={onToggleWidget}>
          <RevenueBySource data={data.revenueBySource} />
        </WidgetWrapper>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing['xl'] }}>
        <WidgetWrapper widgetId="salesPipeline" overviewWidgets={overviewWidgets} activeTab="revenue" onToggle={onToggleWidget}>
          <SalesPipeline data={pipelineData} viewMode={viewMode} />
        </WidgetWrapper>
        <WidgetWrapper widgetId="dealCountByStage" overviewWidgets={overviewWidgets} activeTab="revenue" onToggle={onToggleWidget}>
          <DealCountByStage data={dealCountData} viewMode={viewMode} />
        </WidgetWrapper>
      </div>
      <WidgetWrapper widgetId="highValueDeals" overviewWidgets={overviewWidgets} activeTab="revenue" onToggle={onToggleWidget}>
        <HighValueDeals deals={data.highValueDeals} />
      </WidgetWrapper>
      <WidgetWrapper widgetId="expenseBreakdown" overviewWidgets={overviewWidgets} activeTab="revenue" onToggle={onToggleWidget}>
        <ExpenseBreakdown data={data.expenseBreakdown} />
      </WidgetWrapper>
    </div>
  );
};

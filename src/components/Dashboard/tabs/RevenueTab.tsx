import React from 'react';
import { DollarSign } from 'lucide-react';
import { MockData, WidgetId } from '../../../types/dashboard';
import { WidgetWrapper } from '../WidgetWrapper';
import { RevenueTrend } from '../widgets/RevenueTrend';
import { RevenueBySource } from '../widgets/RevenueBySource';
import { ExpenseBreakdown } from '../widgets/ExpenseBreakdown';
import { SalesPipeline } from '../widgets/SalesPipeline';
import { DealCountByStage } from '../widgets/DealCountByStage';
import { HighValueDeals } from '../widgets/HighValueDeals';

interface RevenueTabProps {
  data: MockData;
  overviewWidgets: WidgetId[];
  onToggleWidget: (widgetId: WidgetId) => void;
}

export const RevenueTab: React.FC<RevenueTabProps> = ({ data, overviewWidgets, onToggleWidget }) => {
  const pipelineData = data.pipeline;
  const dealCountData = data.pipeline;

  return (
    <div role="tabpanel" id="revenue-panel" aria-labelledby="revenue-tab" className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center">
          <DollarSign size={24} className="text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Growth & Pipeline</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Financial performance and sales pipeline analytics</p>
        </div>
      </div>

      {/* Revenue Trend + By Source */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <WidgetWrapper widgetId="revenueTrend" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
            <RevenueTrend data={data.revenue} />
          </WidgetWrapper>
        </div>
        <WidgetWrapper widgetId="revenueBySource" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
          <RevenueBySource data={data.revenueBySource} />
        </WidgetWrapper>
      </div>

      {/* Pipeline + Deal Count */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <WidgetWrapper widgetId="salesPipeline" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
          <SalesPipeline data={pipelineData} />
        </WidgetWrapper>
        <WidgetWrapper widgetId="dealCountByStage" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
          <DealCountByStage data={dealCountData} />
        </WidgetWrapper>
      </div>

      {/* High Value Deals */}
      <WidgetWrapper widgetId="highValueDeals" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
        <HighValueDeals deals={data.highValueDeals} />
      </WidgetWrapper>

      {/* Expense Breakdown */}
      <WidgetWrapper widgetId="expenseBreakdown" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
        <ExpenseBreakdown data={data.expenseBreakdown} />
      </WidgetWrapper>
    </div>
  );
};

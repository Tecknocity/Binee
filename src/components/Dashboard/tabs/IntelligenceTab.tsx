import React, { useState } from 'react';
import { Brain, Database, Sparkles, Target, RefreshCw, AlertCircle, AlertTriangle, Info, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MockData, WidgetId } from '../../../types/dashboard';
import { WidgetWrapper } from '../WidgetWrapper';
import { AIInsights } from '../widgets/AIInsights';
import { cn } from '@/lib/utils';

interface IntelligenceTabProps {
  data: MockData;
  overviewWidgets: WidgetId[];
  onToggleWidget: (widgetId: WidgetId) => void;
}

const DIAGNOSTIC_CARDS = [
  { severity: 'critical' as const, title: 'Pipeline coverage below target', metric: 'Pipeline Coverage', value: '2.8x', trend: 'down' as const, source: 'HubSpot + Stripe', action: 'Increase qualified leads to hit 3x coverage' },
  { severity: 'warning' as const, title: '3 high-value deals stuck', metric: 'Stuck Deals', value: '$115K', trend: 'flat' as const, source: 'HubSpot CRM', action: 'Schedule follow-ups for stale deals this week' },
  { severity: 'info' as const, title: 'Revenue growth accelerating', metric: 'MRR Growth', value: '12.5%', trend: 'up' as const, source: 'Stripe', action: 'Consider increasing marketing spend to capitalize' },
];

const SEVERITY_CONFIG = {
  critical: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-l-destructive', label: 'Critical' },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-l-warning', label: 'Warning' },
  info: { icon: Info, color: 'text-info', bg: 'bg-info/10', border: 'border-l-info', label: 'Info' },
};

export const IntelligenceTab: React.FC<IntelligenceTabProps> = ({ data, overviewWidgets, onToggleWidget }) => {
  const [analyzing, setAnalyzing] = useState(false);

  const handleRunAnalysis = () => {
    setAnalyzing(true);
    setTimeout(() => setAnalyzing(false), 2000);
  };

  const connectedSources = 4;
  const totalSources = 10;
  const confidence = Math.round((connectedSources / totalSources) * 100);

  return (
    <div role="tabpanel" id="intelligence-panel" className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center">
            <Brain size={24} className="text-accent" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Insights</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Predictions and insights powered by your data</p>
          </div>
        </div>
        <button
          onClick={handleRunAnalysis}
          disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={analyzing ? 'animate-spin' : ''} />
          {analyzing ? 'Analyzing...' : 'Run Full Analysis'}
        </button>
      </div>

      {/* Data Confidence Indicator */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Wifi size={16} className="text-primary" />
            <span className="text-sm font-medium text-foreground">Data Confidence</span>
          </div>
          <span className="text-sm font-semibold text-foreground">{confidence}%</span>
        </div>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${confidence}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          {connectedSources} of {totalSources} data sources connected.{' '}
          <Link to="/integrations" className="text-accent hover:underline">Connect more</Link> for better insights.
        </p>
      </div>

      {/* Diagnostic Cards */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Diagnostic Insights</h3>
        <div className="space-y-3">
          {DIAGNOSTIC_CARDS.map((card, i) => {
            const config = SEVERITY_CONFIG[card.severity];
            const Icon = config.icon;
            return (
              <div key={i} className={cn("glass rounded-xl p-5 border-l-[3px] card-hover", config.border)}>
                <div className="flex items-start gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", config.bg)}>
                    <Icon size={18} className={config.color} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="text-base font-semibold text-foreground">{card.title}</h4>
                      <span className={cn("px-2 py-1 rounded-md text-xs font-bold uppercase", config.bg, config.color)}>
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mb-2 text-sm">
                      <span className="text-muted-foreground">{card.metric}:</span>
                      <span className="font-semibold text-foreground">{card.value}</span>
                      <span className={cn("text-xs", card.trend === 'up' ? 'text-success' : card.trend === 'down' ? 'text-destructive' : 'text-muted-foreground')}>
                        {card.trend === 'up' ? '↑' : card.trend === 'down' ? '↓' : '→'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{card.action}</p>
                    <p className="text-xs text-muted-foreground/60">Source: {card.source}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Insights Widget */}
      <WidgetWrapper widgetId="aiInsights" overviewWidgets={overviewWidgets} onToggle={onToggleWidget}>
        <AIInsights predictions={data.predictions} />
      </WidgetWrapper>

      {/* How It Works */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">How Predictions Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: Database, number: '01', title: 'Data Collection', description: 'We aggregate data from all your connected tools in real-time.' },
            { icon: Sparkles, number: '02', title: 'Pattern Analysis', description: 'AI models identify trends, anomalies, and correlations in your business data.' },
            { icon: Target, number: '03', title: 'Actionable Insights', description: 'Receive predictions with confidence scores and recommended actions.' },
          ].map((step) => (
            <div key={step.number} className="bg-background/50 rounded-xl p-5 border border-border/50 hover:border-accent/30 transition-all group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <step.icon size={18} className="text-accent" />
                </div>
                <span className="text-3xl font-bold gradient-text">{step.number}</span>
              </div>
              <h4 className="text-base font-semibold text-foreground mb-2">{step.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

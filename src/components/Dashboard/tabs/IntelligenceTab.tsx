import React from 'react';
import { Brain, Database, Sparkles, Target } from 'lucide-react';
import { MockData, WidgetId } from '../../../types/dashboard';
import { WidgetWrapper } from '../WidgetWrapper';
import { AIInsights } from '../widgets/AIInsights';

interface IntelligenceTabProps {
  data: MockData;
  overviewWidgets: WidgetId[];
  onToggleWidget: (widgetId: WidgetId) => void;
}

export const IntelligenceTab: React.FC<IntelligenceTabProps> = ({ data, overviewWidgets, onToggleWidget }) => {
  const steps = [
    { 
      icon: Database, 
      number: '01', 
      title: 'Data Collection', 
      description: 'We aggregate data from all your connected tools in real-time.' 
    },
    { 
      icon: Sparkles, 
      number: '02', 
      title: 'Pattern Analysis', 
      description: 'AI models identify trends, anomalies, and correlations in your business data.' 
    },
    { 
      icon: Target, 
      number: '03', 
      title: 'Actionable Insights', 
      description: 'Receive predictions with confidence scores and recommended actions.' 
    },
  ];

  return (
    <div role="tabpanel" id="intelligence-panel" aria-labelledby="intelligence-tab" className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center">
          <Brain size={24} className="text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Intelligence</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Predictions and insights powered by AI</p>
        </div>
      </div>

      {/* AI Insights Widget */}
      <WidgetWrapper widgetId="aiInsights" overviewWidgets={overviewWidgets} activeTab="intelligence" onToggle={onToggleWidget}>
        <AIInsights predictions={data.predictions} />
      </WidgetWrapper>

      {/* How It Works */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">How AI Predictions Work</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((step) => (
            <div 
              key={step.number}
              className="bg-background/50 rounded-xl p-5 border border-border/50 transition-all duration-200 hover:border-accent/30 hover:shadow-glow-sm group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
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

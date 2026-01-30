import React from 'react';
import { Brain, TrendingUp } from 'lucide-react';
import { Prediction } from '../../../types/dashboard';
import { cn } from '@/lib/utils';

interface AIInsightsProps {
  predictions: Prediction[];
}

export const AIInsights: React.FC<AIInsightsProps> = ({ predictions }) => {
  return (
    <div className="glass rounded-2xl p-6 card-hover">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
          <Brain size={20} className="text-accent" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">AI Predictions</h3>
          <p className="text-xs text-muted-foreground">Powered by machine learning</p>
        </div>
      </div>
      
      <div className="flex flex-col gap-4">
        {predictions.map((pred, i) => (
          <div 
            key={i} 
            className="bg-background/50 rounded-xl p-5 border border-border/50 transition-all duration-200 hover:border-accent/30"
          >
            <div className="flex justify-between items-start mb-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp size={14} className="text-accent" />
                {pred.title}
              </h4>
              <span className={cn(
                "px-2 py-1 rounded-md text-xs font-bold",
                pred.confidence >= 80 
                  ? "bg-success/15 text-success" 
                  : "bg-warning/15 text-warning"
              )}>
                {pred.confidence}%
              </span>
            </div>
            
            <div className="text-2xl font-bold gradient-text mb-2">
              {pred.prediction}
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              {pred.details}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

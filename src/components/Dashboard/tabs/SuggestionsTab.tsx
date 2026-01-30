import React from 'react';
import { Zap, ArrowRight, TrendingUp, Clock, X } from 'lucide-react';
import { Suggestion } from '../../../types/dashboard';
import { cn } from '@/lib/utils';

interface SuggestionsTabProps {
  suggestions: Suggestion[];
}

export const SuggestionsTab: React.FC<SuggestionsTabProps> = ({ suggestions }) => {
  const highPriority = suggestions.filter((s) => s.priority === 'high');
  const mediumPriority = suggestions.filter((s) => s.priority === 'medium');
  const lowPriority = suggestions.filter((s) => s.priority === 'low');

  const priorityConfig = {
    high: { 
      border: 'border-destructive/30', 
      bg: 'bg-destructive/10',
      color: 'text-destructive', 
      label: 'High Priority',
      sublabel: 'Quick wins available'
    },
    medium: { 
      border: 'border-warning/30', 
      bg: 'bg-warning/10',
      color: 'text-warning', 
      label: 'Medium Priority',
      sublabel: 'Worth considering'
    },
    low: { 
      border: 'border-info/30', 
      bg: 'bg-info/10',
      color: 'text-info', 
      label: 'Low Priority',
      sublabel: 'Nice to have'
    },
  };

  return (
    <div role="tabpanel" id="suggestions-panel" aria-labelledby="suggestions-tab" className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center">
          <Zap size={24} className="text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">System Improvement Suggestions</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Recommendations to optimize your business systems</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { count: highPriority.length, config: priorityConfig.high },
          { count: mediumPriority.length, config: priorityConfig.medium },
          { count: lowPriority.length, config: priorityConfig.low },
        ].map((item, i) => (
          <div 
            key={i}
            className={cn(
              "glass rounded-2xl p-6 border-l-[3px] card-hover",
              item.config.border.replace('/30', '')
            )}
          >
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              {item.config.label}
            </div>
            <div className={cn("text-5xl font-bold mb-1", item.config.color)}>
              {item.count}
            </div>
            <div className="text-sm text-muted-foreground">{item.config.sublabel}</div>
          </div>
        ))}
      </div>

      {/* High Priority Suggestions */}
      {highPriority.map((sug, i) => (
        <div 
          key={i} 
          className="glass rounded-2xl p-6 border-l-[3px] border-l-destructive card-hover"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <h4 className="text-xl font-semibold text-foreground">{sug.title}</h4>
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-destructive/15 text-destructive uppercase">
              High Priority
            </span>
          </div>
          
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{sug.reasoning}</p>
          
          <div className="flex gap-4 p-4 bg-success/10 rounded-xl mb-5 border border-success/20">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase mb-1">
                <TrendingUp size={12} />
                Impact
              </div>
              <div className="text-sm font-semibold text-success">{sug.impact}</div>
            </div>
            <div className="flex-1 text-right">
              <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground uppercase mb-1">
                <Clock size={12} />
                Effort
              </div>
              <div className="text-sm font-semibold text-foreground">{sug.effort}</div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => alert(`Applied: ${sug.title}`)} 
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 gradient-primary text-white rounded-xl text-sm font-semibold transition-all duration-200 hover:shadow-glow hover:opacity-90"
            >
              Apply Now
              <ArrowRight size={16} />
            </button>
            <button 
              onClick={() => alert('Dismissed')} 
              className="flex items-center gap-2 px-5 py-3 bg-transparent border border-border text-muted-foreground rounded-xl text-sm font-medium hover:bg-secondary/50 hover:text-foreground transition-colors"
            >
              <X size={16} />
              Dismiss
            </button>
          </div>
        </div>
      ))}

      {/* Medium Priority Suggestions */}
      {mediumPriority.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-warning flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warning" />
            Medium Priority
          </h3>
          {mediumPriority.map((sug, i) => (
            <div 
              key={i} 
              className="glass rounded-xl p-5 border-l-[3px] border-l-warning"
            >
              <h4 className="text-base font-semibold text-foreground mb-2">{sug.title}</h4>
              <p className="text-sm text-muted-foreground">{sug.reasoning}</p>
            </div>
          ))}
        </div>
      )}

      {/* Low Priority Suggestions */}
      {lowPriority.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-info flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-info" />
            Low Priority
          </h3>
          {lowPriority.map((sug, i) => (
            <div 
              key={i} 
              className="glass rounded-xl p-5 border-l-[3px] border-l-info"
            >
              <h4 className="text-base font-semibold text-foreground mb-2">{sug.title}</h4>
              <p className="text-sm text-muted-foreground">{sug.reasoning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

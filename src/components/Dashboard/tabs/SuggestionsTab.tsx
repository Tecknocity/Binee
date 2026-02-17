import React, { useState } from 'react';
import { Zap, ArrowRight, TrendingUp, Clock, X, ChevronDown, ChevronUp, BookOpen, Lightbulb } from 'lucide-react';
import { Suggestion } from '../../../types/dashboard';
import { cn } from '@/lib/utils';

interface SuggestionsTabProps {
  suggestions: Suggestion[];
}

const KNOWLEDGE_BASE = [
  { title: 'Standardize your pipeline stages', description: 'Your pipeline has 10 stages. Industry best practice suggests 6-7 clearly defined stages: Lead, Qualified, Meeting, Proposal, Negotiation, Closed Won/Lost.', source: 'Binee Knowledge Base' },
  { title: 'Set up automated follow-ups', description: 'Deals that go 14+ days without activity have a 40% lower close rate. Set up automated reminders in your CRM.', source: 'Binee Knowledge Base' },
];

// Map priorities to categories per PRD
const CATEGORY_MAP: Record<string, string> = {
  high: 'quick-win',
  medium: 'this-week',
  low: 'strategic',
};

const CATEGORY_CONFIG = {
  'quick-win': { label: 'Quick Wins', sublabel: '< 1 hour to implement', color: 'text-success', border: 'border-l-success', bg: 'bg-success/10' },
  'this-week': { label: 'This Week', sublabel: 'Worth tackling this week', color: 'text-warning', border: 'border-l-warning', bg: 'bg-warning/10' },
  'strategic': { label: 'Strategic', sublabel: 'Longer-term improvements', color: 'text-info', border: 'border-l-info', bg: 'bg-info/10' },
};

export const SuggestionsTab: React.FC<SuggestionsTabProps> = ({ suggestions }) => {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [dismissedCards, setDismissedCards] = useState<Set<number>>(new Set());

  const quickWins = suggestions.filter(s => s.priority === 'high' && !dismissedCards.has(suggestions.indexOf(s)));
  const thisWeek = suggestions.filter(s => s.priority === 'medium' && !dismissedCards.has(suggestions.indexOf(s)));
  const strategic = suggestions.filter(s => s.priority === 'low' && !dismissedCards.has(suggestions.indexOf(s)));

  const toggleExpand = (idx: number) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const dismiss = (idx: number) => {
    setDismissedCards(prev => new Set(prev).add(idx));
  };

  const renderSection = (title: string, items: Suggestion[], category: keyof typeof CATEGORY_CONFIG) => {
    const config = CATEGORY_CONFIG[category];
    if (items.length === 0) return null;

    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className={cn("w-2 h-2 rounded-full", config.bg.replace('/10', ''))} />
          <h3 className={cn("text-lg font-semibold", config.color)}>{config.label}</h3>
          <span className="text-sm text-muted-foreground">({items.length})</span>
        </div>
        <div className="space-y-4">
          {items.map((sug, i) => {
            const globalIdx = suggestions.indexOf(sug);
            const isExpanded = expandedCards.has(globalIdx);

            return (
              <div key={globalIdx} className={cn("glass rounded-2xl p-6 border-l-[3px] card-hover", config.border)}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h4 className="text-lg font-semibold text-foreground">{sug.title}</h4>
                  <span className={cn("px-2.5 py-1 rounded-md text-xs font-bold uppercase whitespace-nowrap", config.bg, config.color)}>
                    {config.label}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{sug.reasoning}</p>

                <div className="flex gap-4 p-4 bg-background/50 rounded-xl mb-4 border border-border/50">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase mb-1">
                      <TrendingUp size={12} /> Impact
                    </div>
                    <div className="text-sm font-semibold text-success">{sug.impact}</div>
                  </div>
                  <div className="flex-1 text-right">
                    <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground uppercase mb-1">
                      <Clock size={12} /> Effort
                    </div>
                    <div className="text-sm font-semibold text-foreground">{sug.effort}</div>
                  </div>
                </div>

                {/* Implementation steps (expandable) */}
                <button onClick={() => toggleExpand(globalIdx)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {isExpanded ? 'Hide steps' : 'Show implementation steps'}
                </button>

                {isExpanded && (
                  <div className="mb-4 pl-4 border-l-2 border-border/50 space-y-2 animate-fade-in">
                    <p className="text-sm text-muted-foreground">1. Review current configuration in {sug.action}</p>
                    <p className="text-sm text-muted-foreground">2. Apply recommended changes</p>
                    <p className="text-sm text-muted-foreground">3. Verify data quality improvement</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 gradient-primary text-white rounded-xl text-sm font-semibold transition-all hover:shadow-glow hover:opacity-90">
                    Implement <ArrowRight size={16} />
                  </button>
                  <button onClick={() => dismiss(globalIdx)} className="flex items-center gap-2 px-5 py-3 border border-border text-muted-foreground rounded-xl text-sm font-medium hover:bg-secondary/50 hover:text-foreground transition-colors">
                    <X size={16} /> Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div role="tabpanel" id="suggestions-panel" className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center">
          <Lightbulb size={24} className="text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Actions</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Recommended next steps to optimize your business</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { count: quickWins.length, config: CATEGORY_CONFIG['quick-win'] },
          { count: thisWeek.length, config: CATEGORY_CONFIG['this-week'] },
          { count: strategic.length, config: CATEGORY_CONFIG['strategic'] },
        ].map((item, i) => (
          <div key={i} className={cn("glass rounded-2xl p-6 border-l-[3px] card-hover", item.config.border)}>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{item.config.label}</div>
            <div className={cn("text-5xl font-bold mb-1", item.config.color)}>{item.count}</div>
            <div className="text-sm text-muted-foreground">{item.config.sublabel}</div>
          </div>
        ))}
      </div>

      {renderSection('Quick Wins', quickWins, 'quick-win')}
      {renderSection('This Week', thisWeek, 'this-week')}
      {renderSection('Strategic', strategic, 'strategic')}

      {/* Knowledge Base */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <BookOpen size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Best Practices</h3>
            <p className="text-xs text-muted-foreground">From Binee's knowledge base</p>
          </div>
        </div>
        <div className="space-y-4">
          {KNOWLEDGE_BASE.map((kb, i) => (
            <div key={i} className="bg-background/50 rounded-xl p-5 border border-border/50">
              <h4 className="text-base font-semibold text-foreground mb-2">{kb.title}</h4>
              <p className="text-sm text-muted-foreground mb-2">{kb.description}</p>
              <p className="text-xs text-muted-foreground/60">{kb.source}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

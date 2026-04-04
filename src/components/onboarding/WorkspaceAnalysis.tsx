'use client';

import {
  Loader2,
  FolderOpen,
  Folder,
  List,
  Users,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Inbox,
  CheckSquare,
  ShieldCheck,
  Wrench,
  Plus,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceAnalysisProps {
  isAnalyzing: boolean;
  analysisSummary: string | null;
  counts: { spaces: number; folders: number; lists: number; tasks: number; members: number } | null;
  findings: Array<{ type: string; text: string }>;
  recommendations: Array<{ action: string; text: string }>;
  onContinue: () => void;
}

// ---------------------------------------------------------------------------
// Icons for recommendation actions
// ---------------------------------------------------------------------------

const ACTION_ICONS: Record<string, React.ReactNode> = {
  keep: <ShieldCheck className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />,
  improve: <Wrench className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />,
  add: <Plus className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />,
};

const ACTION_LABELS: Record<string, string> = {
  keep: 'Keep',
  improve: 'Improve',
  add: 'Add',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceAnalysis({
  isAnalyzing,
  analysisSummary,
  counts,
  findings,
  recommendations,
  onContinue,
}: WorkspaceAnalysisProps) {
  // Loading state
  if (isAnalyzing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">Analyzing your workspace</h2>
        <p className="text-sm text-text-secondary text-center max-w-sm">
          Syncing your ClickUp workspace and scanning the structure...
        </p>
      </div>
    );
  }

  // No data at all — ready to build
  if (!analysisSummary && !counts) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
          <Inbox className="w-8 h-8 text-accent" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-text-primary mb-2">Ready to build</h2>
          <p className="text-sm text-text-secondary">
            Let&apos;s set up your ClickUp workspace with a structure tailored to your business.
          </p>
        </div>
        <button
          onClick={onContinue}
          className="flex items-center gap-2 px-6 py-3 bg-accent text-white font-medium rounded-xl
            hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
        >
          <Sparkles className="w-4 h-4" />
          Start Building
        </button>
      </div>
    );
  }

  const stats = counts ?? { spaces: 0, folders: 0, lists: 0, tasks: 0, members: 0 };
  const isEmpty = stats.spaces === 0 && stats.folders === 0 && stats.lists === 0;

  // Empty workspace
  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
          <Inbox className="w-8 h-8 text-accent" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-text-primary mb-2">Fresh workspace detected</h2>
          <p className="text-sm text-text-secondary">
            Your ClickUp workspace is empty — a clean slate! Let&apos;s build the perfect
            structure for your business from scratch.
          </p>
        </div>
        <button
          onClick={onContinue}
          className="flex items-center gap-2 px-6 py-3 bg-accent text-white font-medium rounded-xl
            hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
        >
          <Sparkles className="w-4 h-4" />
          Start Building
        </button>
      </div>
    );
  }

  // Existing workspace — full report
  const hasWarnings = findings.some((f) => f.type === 'warning');

  const ctaLabel = hasWarnings ? 'Improve Workspace' : 'Fine-tune Workspace';

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto px-4 pb-8">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="py-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary">Workspace Analysis</h2>
          <p className="text-base text-text-secondary mt-2">
            We&apos;ve analyzed your current ClickUp workspace. Here are the results.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Spaces', value: stats.spaces, icon: FolderOpen },
            { label: 'Folders', value: stats.folders, icon: Folder },
            { label: 'Lists', value: stats.lists, icon: List },
            { label: 'Tasks', value: stats.tasks, icon: CheckSquare },
            { label: 'Members', value: stats.members, icon: Users },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface border border-border rounded-xl p-4 text-center">
              <stat.icon className="w-5 h-5 text-text-muted mx-auto mb-2" />
              <p className="text-2xl font-bold text-text-primary font-mono">{stat.value}</p>
              <p className="text-xs text-text-muted uppercase tracking-wider mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Key Findings */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-5">
          <h3 className="text-base font-semibold text-text-primary mb-4">Key Findings</h3>
          {findings.length > 0 ? (
            <div className="space-y-3">
              {findings.map((finding, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-navy-base/50">
                  {finding.type === 'good' && (
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  )}
                  {finding.type === 'warning' && (
                    <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  )}
                  {finding.type === 'info' && (
                    <TrendingUp className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm text-text-secondary leading-relaxed">{finding.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">No specific findings — workspace looks standard.</p>
          )}
        </div>

        {/* Recommendations */}
        <div className="bg-accent/5 border border-accent/15 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2.5 mb-4">
            <Sparkles className="w-5 h-5 text-accent" />
            <h3 className="text-base font-semibold text-accent">Recommendations</h3>
          </div>
          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3">
                  {ACTION_ICONS[rec.action] || <Wrench className="w-5 h-5 text-text-muted flex-shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded mr-2 ${
                      rec.action === 'keep' ? 'bg-success/15 text-success' :
                      rec.action === 'improve' ? 'bg-warning/15 text-warning' :
                      'bg-accent/15 text-accent'
                    }`}>
                      {ACTION_LABELS[rec.action] || rec.action}
                    </span>
                    <span className="text-sm text-text-secondary leading-relaxed">{rec.text}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary leading-relaxed">
              {stats.spaces >= 3
                ? "Your workspace has a solid foundation. Let's discuss what's working and what could be improved."
                : "Let's build on your existing workspace with a structure tailored to your business needs."}
            </p>
          )}
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <button
            onClick={onContinue}
            className="flex items-center gap-2.5 px-8 py-3.5 bg-accent text-white font-semibold text-base rounded-xl
              hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
          >
            {ctaLabel}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

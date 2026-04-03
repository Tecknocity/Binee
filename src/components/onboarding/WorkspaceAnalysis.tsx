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
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceAnalysisProps {
  isAnalyzing: boolean;
  analysisSummary: string | null;
  /** Hard counts from Supabase cached tables — reliable, not AI-parsed */
  counts: { spaces: number; folders: number; lists: number; tasks: number; members: number } | null;
  onContinue: () => void;
}

interface Finding {
  type: 'good' | 'warning' | 'info';
  text: string;
}

// ---------------------------------------------------------------------------
// Extract findings from the AI summary text (qualitative only, no numbers)
// ---------------------------------------------------------------------------

function extractFindings(summary: string): Finding[] {
  const findings: Finding[] = [];
  const sentences = summary.split(/[.\n]/).filter((s) => s.trim().length > 15);

  for (const s of sentences.slice(0, 8)) {
    const trimmed = s.trim();
    // Skip lines that are just headers/labels
    if (/^#+\s|^\*\*[A-Z]/.test(trimmed)) continue;
    if (/^[-•]\s*$/.test(trimmed)) continue;

    if (/overdue|missing|empty|unused|inconsist|duplicate|problem|issue|stale|no\s+\w+\s+found/i.test(trimmed)) {
      findings.push({ type: 'warning', text: trimmed.replace(/^[-•*#\s]+/, '') });
    } else if (/good|well|active|organized|clean|healthy|strong|excellent/i.test(trimmed)) {
      findings.push({ type: 'good', text: trimmed.replace(/^[-•*#\s]+/, '') });
    } else if (trimmed.length > 20 && !/^\d+\s|^total|^count/i.test(trimmed)) {
      findings.push({ type: 'info', text: trimmed.replace(/^[-•*#\s]+/, '') });
    }
  }

  return findings.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceAnalysis({
  isAnalyzing,
  analysisSummary,
  counts,
  onContinue,
}: WorkspaceAnalysisProps) {
  // Loading state — only show while actively analyzing
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

  // If analysis finished but no data, treat as empty workspace
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

  // Use hard counts from DB (reliable), fall back to zeros
  const stats = counts ?? { spaces: 0, folders: 0, lists: 0, tasks: 0, members: 0 };
  const isEmpty = stats.spaces === 0 && stats.folders === 0 && stats.lists === 0;

  // Empty workspace — simple CTA
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

  // Existing workspace — show report card
  const findings = analysisSummary ? extractFindings(analysisSummary) : [];
  const warningCount = findings.filter((f) => f.type === 'warning').length;
  const recommendation =
    warningCount >= 2 ? 'improve' :
    stats.spaces >= 3 ? 'fine_tune' : 'improve';

  const ctaLabel =
    recommendation === 'fine_tune' ? 'Fine-tune Workspace' : 'Improve Workspace';

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pb-6 overflow-y-auto">
      {/* Header */}
      <div className="py-6 text-center">
        <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-3">
          <TrendingUp className="w-7 h-7 text-accent" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">Workspace Analysis</h2>
        <p className="text-sm text-text-secondary mt-1">
          Here&apos;s what we found in your current ClickUp workspace
        </p>
      </div>

      {/* Stats grid — numbers from database, not AI */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {[
          { label: 'Spaces', value: stats.spaces, icon: FolderOpen },
          { label: 'Folders', value: stats.folders, icon: Folder },
          { label: 'Lists', value: stats.lists, icon: List },
          { label: 'Tasks', value: stats.tasks, icon: CheckSquare },
          { label: 'Members', value: stats.members, icon: Users },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface border border-border rounded-xl p-3 text-center">
            <stat.icon className="w-4 h-4 text-text-muted mx-auto mb-1" />
            <p className="text-lg font-semibold text-text-primary font-mono">{stat.value}</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Findings from AI (qualitative only) */}
      {findings.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Key Findings</h3>
          <div className="space-y-2.5">
            {findings.map((finding, i) => (
              <div key={i} className="flex items-start gap-2.5">
                {finding.type === 'good' && (
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                )}
                {finding.type === 'warning' && (
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                )}
                {finding.type === 'info' && (
                  <TrendingUp className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm text-text-secondary leading-relaxed">{finding.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className="bg-accent/5 border border-accent/15 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-accent mb-1">Recommendation</p>
            <p className="text-sm text-text-secondary leading-relaxed">
              {recommendation === 'fine_tune'
                ? "Your workspace is well-organized! We can suggest some minor improvements and optimizations to make it even better."
                : "Your workspace has a solid foundation. Let's discuss what's working and what could be improved — we'll build alongside your existing structure."}
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex justify-center pt-2">
        <button
          onClick={onContinue}
          className="flex items-center gap-2 px-6 py-3 bg-accent text-white font-medium rounded-xl
            hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
        >
          {ctaLabel}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

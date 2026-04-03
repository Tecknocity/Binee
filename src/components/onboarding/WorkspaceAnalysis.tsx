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
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceAnalysisProps {
  isAnalyzing: boolean;
  analysisSummary: string | null;
  onContinue: () => void;
}

interface ParsedAnalysis {
  isEmpty: boolean;
  spaces: number;
  folders: number;
  lists: number;
  tasks: number;
  members: number;
  findings: Array<{ type: 'good' | 'warning' | 'info'; text: string }>;
  recommendation: 'build_fresh' | 'improve' | 'fine_tune';
}

// ---------------------------------------------------------------------------
// Parse the workspace_analyst summary into structured data
// ---------------------------------------------------------------------------

function parseAnalysis(summary: string): ParsedAnalysis {
  const lower = summary.toLowerCase();

  // Detect empty workspace
  const isEmpty =
    lower.includes('empty') ||
    lower.includes('no spaces') ||
    lower.includes('0 spaces') ||
    lower.includes('no workspace data') ||
    lower.includes('not connected');

  // Extract counts (best-effort regex)
  const spaces = extractCount(summary, /(\d+)\s*spaces?/i) ?? 0;
  const folders = extractCount(summary, /(\d+)\s*folders?/i) ?? 0;
  const lists = extractCount(summary, /(\d+)\s*lists?/i) ?? 0;
  const tasks = extractCount(summary, /(\d+)\s*tasks?/i) ?? 0;
  const members = extractCount(summary, /(\d+)\s*(?:members?|users?|people)/i) ?? 0;

  // Extract findings from the summary text
  const findings: ParsedAnalysis['findings'] = [];
  const sentences = summary.split(/[.\n]/).filter((s) => s.trim().length > 10);

  for (const s of sentences.slice(0, 6)) {
    const trimmed = s.trim();
    if (/overdue|missing|empty|unused|inconsist|duplicate|problem|issue/i.test(trimmed)) {
      findings.push({ type: 'warning', text: trimmed });
    } else if (/good|well|active|organized|clean|healthy/i.test(trimmed)) {
      findings.push({ type: 'good', text: trimmed });
    } else if (trimmed.length > 15) {
      findings.push({ type: 'info', text: trimmed });
    }
  }

  // Cap at 5 findings
  const cappedFindings = findings.slice(0, 5);

  // Determine recommendation
  let recommendation: ParsedAnalysis['recommendation'] = 'build_fresh';
  if (!isEmpty && spaces >= 3) {
    recommendation = cappedFindings.filter((f) => f.type === 'warning').length >= 2 ? 'improve' : 'fine_tune';
  } else if (!isEmpty && spaces >= 1) {
    recommendation = 'improve';
  }

  return { isEmpty, spaces, folders, lists, tasks, members, findings: cappedFindings, recommendation };
}

function extractCount(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  return match ? parseInt(match[1], 10) : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceAnalysis({
  isAnalyzing,
  analysisSummary,
  onContinue,
}: WorkspaceAnalysisProps) {
  // Loading state
  if (isAnalyzing || !analysisSummary) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">Analyzing your workspace</h2>
        <p className="text-sm text-text-secondary text-center max-w-sm">
          Scanning your ClickUp workspace structure, tasks, and team setup...
        </p>
      </div>
    );
  }

  const analysis = parseAnalysis(analysisSummary);

  // Empty workspace view
  if (analysis.isEmpty) {
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

  // Existing workspace report
  const ctaLabel =
    analysis.recommendation === 'fine_tune' ? 'Fine-tune Workspace' :
    analysis.recommendation === 'improve' ? 'Improve Workspace' :
    'Start Building';

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

      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {[
          { label: 'Spaces', value: analysis.spaces, icon: FolderOpen },
          { label: 'Folders', value: analysis.folders, icon: Folder },
          { label: 'Lists', value: analysis.lists, icon: List },
          { label: 'Tasks', value: analysis.tasks, icon: CheckCircle2 },
          { label: 'Members', value: analysis.members, icon: Users },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface border border-border rounded-xl p-3 text-center">
            <stat.icon className="w-4 h-4 text-text-muted mx-auto mb-1" />
            <p className="text-lg font-semibold text-text-primary font-mono">{stat.value}</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Findings */}
      {analysis.findings.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Key Findings</h3>
          <div className="space-y-2.5">
            {analysis.findings.map((finding, i) => (
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
              {analysis.recommendation === 'fine_tune'
                ? "Your workspace is well-organized! We can suggest some minor improvements and optimizations to make it even better."
                : analysis.recommendation === 'improve'
                  ? "Your workspace has a solid foundation. Let's discuss what's working and what could be improved — we'll build alongside your existing structure."
                  : "Let's build your workspace from scratch with a structure tailored to your business."}
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

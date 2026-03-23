'use client';

import { useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Search,
  FolderOpen,
  FileText,
  Users,
  List,
  Pencil,
  Plus,
  LayoutDashboard,
  UserCheck,
  ArrowRightLeft,
  CircleCheck,
  Wrench,
} from 'lucide-react';
import type { ToolCallDisplay } from '@/hooks/useChat';

// ---------------------------------------------------------------------------
// B-054 — Tool Call Indicator
//
// Visual indicators when AI is performing ClickUp actions.
// States: pending (spinner + action text), success (checkmark + result
// summary, expandable), error (X + error message, expandable).
// ---------------------------------------------------------------------------

interface ToolCallIndicatorProps {
  toolCall: ToolCallDisplay;
}

/** Map tool names to contextual icons */
const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  clickup_get_tasks: Search,
  clickup_get_spaces: FolderOpen,
  clickup_get_task: FileText,
  clickup_get_members: Users,
  clickup_get_lists: List,
  clickup_get_folders: FolderOpen,
  clickup_update_task: Pencil,
  clickup_create_task: Plus,
  create_task: Plus,
  update_task: Pencil,
  assign_task: UserCheck,
  move_task: ArrowRightLeft,
  list_dashboards: LayoutDashboard,
  create_dashboard_widget: Plus,
  update_dashboard_widget: Pencil,
  write_operation: CircleCheck,
};

/**
 * Attempts to format raw JSON result into human-readable key-value pairs.
 */
function formatResultDetails(result: string): string {
  try {
    const parsed = JSON.parse(result);
    if (typeof parsed === 'string') return parsed;
    if (typeof parsed !== 'object' || parsed === null) return result;

    const lines: string[] = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('_')) continue; // skip internal fields
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      if (Array.isArray(value)) {
        lines.push(`${label}: ${value.length} item${value.length !== 1 ? 's' : ''}`);
      } else if (typeof value === 'object' && value !== null) {
        lines.push(`${label}: ${JSON.stringify(value, null, 2)}`);
      } else {
        lines.push(`${label}: ${value}`);
      }
    }
    return lines.join('\n') || result;
  } catch {
    return result;
  }
}

export default function ToolCallIndicator({ toolCall }: ToolCallIndicatorProps) {
  const [expanded, setExpanded] = useState(false);

  const isPending = toolCall.status === 'pending';
  const isSuccess = toolCall.status === 'success';
  const isError = toolCall.status === 'error';
  const hasDetails = (isSuccess && toolCall.result) || (isError && toolCall.error);

  const ToolIcon = TOOL_ICONS[toolCall.tool_name] ?? Wrench;

  return (
    <div
      className={`my-1.5 rounded-lg border overflow-hidden text-sm transition-colors ${
        isError
          ? 'border-error/30 bg-error/5'
          : isPending
            ? 'border-accent/30 bg-accent/5'
            : 'border-border bg-navy-base/50'
      }`}
    >
      <button
        onClick={() => hasDetails && !isPending && setExpanded((p) => !p)}
        disabled={isPending || !hasDetails}
        className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors ${
          hasDetails && !isPending ? 'hover:bg-surface-hover/40 cursor-pointer' : 'cursor-default'
        }`}
        aria-expanded={hasDetails ? expanded : undefined}
      >
        {/* Status icon */}
        <div className="shrink-0">
          {isPending && (
            <Loader2 className="w-4 h-4 text-accent animate-spin" />
          )}
          {isSuccess && (
            <CheckCircle2 className="w-4 h-4 text-success" />
          )}
          {isError && (
            <XCircle className="w-4 h-4 text-error" />
          )}
        </div>

        {/* Tool icon + description */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ToolIcon
            className={`w-3.5 h-3.5 shrink-0 ${
              isPending ? 'text-accent/60' : isError ? 'text-error/60' : 'text-text-muted'
            }`}
          />
          <div className="flex-1 min-w-0">
            <span
              className={`block truncate ${
                isPending
                  ? 'text-text-secondary animate-pulse'
                  : isError
                    ? 'text-error/90'
                    : 'text-text-secondary'
              }`}
            >
              {isPending ? `${toolCall.description}...` : toolCall.description}
            </span>

            {/* Result summary inline for success */}
            {isSuccess && toolCall.resultSummary && (
              <span className="block text-xs text-text-muted mt-0.5 truncate">
                {toolCall.resultSummary}
              </span>
            )}

            {/* Error summary inline */}
            {isError && toolCall.error && (
              <span className="block text-xs text-error/70 mt-0.5 truncate">
                {toolCall.error}
              </span>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        {hasDetails && !isPending && (
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {/* Expandable details */}
      {expanded && hasDetails && (
        <div className="px-3 pb-2.5 border-t border-border/60">
          <div className="mt-2 text-xs font-mono text-text-muted whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto">
            {isSuccess && toolCall.result && formatResultDetails(toolCall.result)}
            {isError && toolCall.error}
          </div>
        </div>
      )}
    </div>
  );
}

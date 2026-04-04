'use client';

import { useState } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Info } from 'lucide-react';
import type { ActionConfirmationData } from '@/hooks/useChat';

// ---------------------------------------------------------------------------
// Human-friendly operation type labels
// ---------------------------------------------------------------------------

const OPERATION_LABELS: Record<string, string> = {
  create_task: 'Create Task',
  update_task: 'Update Task',
  assign_task: 'Assign Task',
  move_task: 'Move Task',
  delete_task: 'Delete Task',
  write_operation: 'Write Operation',
};

function formatOperationType(toolName: string): string {
  return OPERATION_LABELS[toolName] ?? toolName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Risk tier config
// ---------------------------------------------------------------------------

const TIER_CONFIG = {
  low: { label: 'Low Risk', dotClass: 'bg-success', textClass: 'text-success' },
  medium: { label: 'Medium Risk', dotClass: 'bg-warning', textClass: 'text-warning' },
  high: { label: 'High Risk', dotClass: 'bg-error', textClass: 'text-error' },
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ActionConfirmationProps {
  data: ActionConfirmationData;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onAlwaysAllow?: (id: string, toolName: string) => void;
}

export default function ActionConfirmation({
  data,
  onConfirm,
  onCancel,
  onAlwaysAllow,
}: ActionConfirmationProps) {
  const isPending = data.confirmed === null;
  const [alwaysAllowNotice, setAlwaysAllowNotice] = useState(false);

  // Only low and medium risk operations are eligible for "Always Allow"
  const showAlwaysAllow =
    isPending &&
    onAlwaysAllow &&
    (data.trust_tier === 'low' || data.trust_tier === 'medium');

  const tier = TIER_CONFIG[data.trust_tier];

  const handleAlwaysAllow = () => {
    if (!onAlwaysAllow) return;
    onAlwaysAllow(data.id, data.tool_name);
    setAlwaysAllowNotice(true);
  };

  return (
    <div className="my-3 rounded-xl border border-border bg-navy-base/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface/30">
        {data.trust_tier === 'high' ? (
          <ShieldAlert className="w-4 h-4 text-warning" />
        ) : (
          <ShieldCheck className="w-4 h-4 text-accent" />
        )}
        <span className="text-sm font-medium text-text-primary">
          Action Confirmation
        </span>

        {/* Operation type label + risk tier dot */}
        <span className="ml-auto flex items-center gap-2 text-xs text-text-muted">
          <span className="bg-navy-dark px-2 py-0.5 rounded font-mono">
            {formatOperationType(data.tool_name)}
          </span>

          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${tier.dotClass}`} />
            <span className={tier.textClass}>{tier.label}</span>
          </span>
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm text-text-primary">{data.description}</p>
        <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap bg-navy-dark rounded-lg px-3 py-2">
          {data.details}
        </pre>
      </div>

      {/* Actions / Status */}
      <div className="px-4 py-3 border-t border-border">
        {isPending ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onConfirm(data.id)}
              className="px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Confirm
            </button>
            {showAlwaysAllow && (
              <button
                onClick={handleAlwaysAllow}
                className="px-4 py-1.5 rounded-lg border border-accent/40 text-accent text-sm font-medium hover:bg-accent/10 transition-colors"
              >
                Always Allow
              </button>
            )}
            <button
              onClick={() => onCancel(data.id)}
              className="px-4 py-1.5 rounded-lg text-text-secondary text-sm font-medium hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Status line */}
            {data.confirmed ? (
              <span className="text-sm text-success flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Action confirmed{alwaysAllowNotice ? ' and auto-approved for future use' : ''}
              </span>
            ) : (
              <span className="text-sm text-text-muted flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                Action cancelled. No changes were made.
              </span>
            )}

            {/* Always Allow toast/notice */}
            {alwaysAllowNotice && (
              <div className="flex items-start gap-2 text-xs text-text-secondary bg-accent/5 border border-accent/20 rounded-lg px-3 py-2">
                <Info className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                <span>
                  Got it! I won&apos;t ask again for <strong className="text-text-primary">{formatOperationType(data.tool_name)}</strong>.
                  You can change this in{' '}
                  <a href="/settings?tab=privacy" className="text-accent hover:text-accent-hover underline underline-offset-2">
                    Settings
                  </a>.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

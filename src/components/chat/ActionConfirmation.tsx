'use client';

import { ShieldCheck, ShieldAlert } from 'lucide-react';
import type { ActionConfirmationData } from '@/hooks/useChat';

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

  // Only low and medium risk operations are eligible for "Always Allow"
  const showAlwaysAllow =
    isPending &&
    onAlwaysAllow &&
    (data.trust_tier === 'low' || data.trust_tier === 'medium');

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
        {data.trust_tier === 'high' && (
          <span className="text-[10px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded">
            High Risk
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm text-text-primary">{data.description}</p>
        <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap bg-navy-dark/50 rounded-lg px-3 py-2">
          {data.details}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
        {isPending ? (
          <>
            <button
              onClick={() => onConfirm(data.id)}
              className="px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Confirm
            </button>
            {showAlwaysAllow && (
              <button
                onClick={() => onAlwaysAllow(data.id, data.tool_name)}
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
          </>
        ) : data.confirmed ? (
          <span className="text-sm text-success flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Confirmed
          </span>
        ) : (
          <span className="text-sm text-text-muted">Cancelled</span>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import type { ToolCallDisplay } from '@/hooks/useChat';

interface ToolCallIndicatorProps {
  toolCall: ToolCallDisplay;
}

export default function ToolCallIndicator({ toolCall }: ToolCallIndicatorProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-2 rounded-lg border border-border bg-navy-base/50 overflow-hidden text-sm">
      <button
        onClick={() =>
          toolCall.status !== 'pending' && setExpanded((p) => !p)
        }
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-surface-hover/40 transition-colors"
      >
        {toolCall.status === 'pending' && (
          <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
        )}
        {toolCall.status === 'success' && (
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        )}
        {toolCall.status === 'error' && (
          <XCircle className="w-4 h-4 text-error shrink-0" />
        )}

        <span
          className={`flex-1 ${
            toolCall.status === 'pending'
              ? 'text-text-secondary animate-pulse'
              : toolCall.status === 'error'
                ? 'text-error'
                : 'text-text-secondary'
          }`}
        >
          {toolCall.description}
        </span>

        {toolCall.status !== 'pending' && (
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-muted transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-2.5 pt-0 border-t border-border">
          <div className="mt-2 text-xs font-mono text-text-muted whitespace-pre-wrap">
            {toolCall.status === 'success' && toolCall.result}
            {toolCall.status === 'error' && toolCall.error}
          </div>
        </div>
      )}
    </div>
  );
}

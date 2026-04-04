'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SendHorizontal, Hexagon } from 'lucide-react';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function ChatInput({ onSend, disabled, placeholder, autoFocus = true }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  // Re-focus after processing completes
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter or Cmd/Ctrl+Enter sends, Shift+Enter adds newline
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <div className="border-t border-border bg-navy-base/80 backdrop-blur-sm px-4 py-3">
      {/* Thinking indicator */}
      {disabled && (
        <div className="flex items-center gap-2 justify-center mb-2">
          <Hexagon className="w-3.5 h-3.5 text-accent animate-pulse" />
          <span className="text-xs text-text-secondary animate-pulse">
            Binee is thinking...
          </span>
        </div>
      )}

      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Ask Binee anything about your workspace...'}
            disabled={disabled}
            rows={1}
            className="w-full resize-none bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="shrink-0 w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={`Send (${modKey}+Enter)`}
        >
          <SendHorizontal className="w-4 h-4" />
        </button>
      </div>
      <p className="text-center text-[11px] text-text-muted mt-1.5">
        <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-text-muted text-[11px]">Enter</kbd> to send
        <span className="mx-1.5 text-text-muted/50">|</span>
        <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-text-muted text-[11px]">{modKey}</kbd>+<kbd className="px-1 py-0.5 rounded bg-surface border border-border text-text-muted text-[11px]">Enter</kbd> to send
        <span className="mx-1.5 text-text-muted/50">|</span>
        <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-text-muted text-[11px]">Shift</kbd>+<kbd className="px-1 py-0.5 rounded bg-surface border border-border text-text-muted text-[11px]">Enter</kbd> for new line
      </p>
    </div>
  );
}

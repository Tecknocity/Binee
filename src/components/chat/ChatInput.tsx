'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SendHorizontal, Hexagon, Paperclip, X, FileSpreadsheet, FileText } from 'lucide-react';
import { parseFile, getFileError, isFileSupported, formatAttachmentsForAI } from '@/lib/file-parser';
import type { FileAttachment } from '@/lib/file-parser';

interface ChatInputProps {
  onSend: (content: string, fileContext?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function ChatInput({ onSend, disabled, placeholder, autoFocus = true }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Clear file error after 5 seconds
  useEffect(() => {
    if (!fileError) return;
    const t = setTimeout(() => setFileError(null), 5000);
    return () => clearTimeout(t);
  }, [fileError]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setFileError(null);
    const fileArray = Array.from(files);

    // Limit to 3 attachments total
    if (attachments.length + fileArray.length > 3) {
      setFileError('Maximum 3 files per message');
      return;
    }

    for (const file of fileArray) {
      const error = getFileError(file);
      if (error) {
        setFileError(error);
        return;
      }
    }

    setIsParsing(true);
    try {
      const parsed = await Promise.all(
        fileArray.map(async (file) => {
          const result = await parseFile(file);
          return {
            name: result.name,
            type: result.type,
            content: result.content,
            rowCount: result.rowCount,
            columns: result.columns,
          } as FileAttachment;
        }),
      );
      setAttachments((prev) => [...prev, ...parsed]);
    } catch {
      setFileError('Failed to parse file. Please try a different format.');
    } finally {
      setIsParsing(false);
    }
  }, [attachments.length]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;

    // Build file context string from attachments
    const fileContext = attachments.length > 0 ? formatAttachmentsForAI(attachments) : undefined;

    onSend(trimmed || 'Please analyze the attached file(s).', fileContext);
    setValue('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend, attachments]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter(isFileSupported);
    if (files.length > 0) {
      handleFiles(files);
    } else if (e.dataTransfer.files.length > 0) {
      setFileError('Unsupported file type. Use CSV, XLSX, TXT, MD, or JSON.');
    }
  }, [disabled, handleFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset input so re-selecting the same file triggers onChange
    e.target.value = '';
  }, [handleFiles]);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const getFileIcon = (type: FileAttachment['type']) => {
    if (type === 'csv' || type === 'xlsx') return FileSpreadsheet;
    return FileText;
  };

  return (
    <div
      className={`border-t border-border bg-navy-base/80 backdrop-blur-sm px-4 py-3 transition-colors ${isDragOver ? 'border-accent/50 bg-accent/5' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Thinking indicator */}
      {disabled && !isParsing && (
        <div className="flex items-center gap-2 justify-center mb-2">
          <Hexagon className="w-3.5 h-3.5 text-accent animate-pulse" />
          <span className="text-xs text-text-secondary animate-pulse">
            Binee is thinking...
          </span>
        </div>
      )}

      {/* Drag overlay indicator */}
      {isDragOver && (
        <div className="flex items-center gap-2 justify-center mb-2">
          <Paperclip className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs text-accent font-medium">
            Drop files here (CSV, XLSX, TXT, MD, JSON)
          </span>
        </div>
      )}

      {/* File error */}
      {fileError && (
        <div className="flex items-center gap-2 justify-center mb-2">
          <span className="text-xs text-red-400">{fileError}</span>
        </div>
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 max-w-3xl mx-auto">
          {attachments.map((att, i) => {
            const Icon = getFileIcon(att.type);
            return (
              <div
                key={`${att.name}-${i}`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-xs text-text-secondary"
              >
                <Icon className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="truncate max-w-[150px]">{att.name}</span>
                {att.rowCount !== undefined && (
                  <span className="text-text-muted">({att.rowCount} rows)</span>
                )}
                <button
                  onClick={() => removeAttachment(i)}
                  className="ml-0.5 p-0.5 rounded hover:bg-border transition-colors"
                  title="Remove file"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        {/* File upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isParsing}
          className="shrink-0 w-10 h-10 rounded-xl bg-surface border border-border text-text-muted flex items-center justify-center hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Attach file (CSV, XLSX, TXT, MD, JSON)"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.txt,.md,.json,.tsv"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

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
          disabled={disabled || (!value.trim() && attachments.length === 0)}
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

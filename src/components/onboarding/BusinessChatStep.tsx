'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Briefcase,
  Loader2,
  CheckCircle2,
  Circle,
  Users,
  Wrench,
  GitBranch,
  Pencil,
  Paperclip,
  X,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import type { SetupChatMessage, ProfileFormData } from '@/hooks/useSetup';
import { parseFile, getFileError, isFileSupported, formatAttachmentsForAI } from '@/lib/file-parser';
import type { FileAttachment } from '@/lib/file-parser';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BusinessChatStepProps {
  messages: SetupChatMessage[];
  isSending: boolean;
  messageCount: number;
  profileFormData: ProfileFormData | null;
  onSendMessage: (msg: string, fileContext?: string) => void;
  onEditProfile: () => void;
}

// (Templates removed - profile form now collects business info directly)

// ---------------------------------------------------------------------------
// Profile progress items
// ---------------------------------------------------------------------------

const PROFILE_FORM_FIELDS: Array<{
  key: keyof ProfileFormData;
  label: string;
  icon: typeof Briefcase;
  hint: string;
}> = [
  {
    key: 'industry',
    label: 'Industry',
    icon: Briefcase,
    hint: 'What industry is your business in?',
  },
  {
    key: 'workStyle',
    label: 'Work style',
    icon: GitBranch,
    hint: 'How is your work structured?',
  },
  {
    key: 'teamSize',
    label: 'Team size',
    icon: Users,
    hint: 'How many team members?',
  },
  {
    key: 'services',
    label: 'Services / Products',
    icon: Wrench,
    hint: 'What does your business offer?',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WORK_STYLE_LABELS: Record<string, string> = {
  'client-based': 'Client-based',
  'product-based': 'Product-based',
  'project-based': 'Project-based',
  'operations-based': 'Operations-based',
};

export function BusinessChatStep({
  messages,
  isSending,
  messageCount,
  profileFormData,
  onSendMessage,
  onEditProfile,
}: BusinessChatStepProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canGenerate = messageCount >= 1;
  const completeness = profileFormData
    ? PROFILE_FORM_FIELDS.filter((f) => {
        const val = profileFormData[f.key];
        return val && val.trim().length > 0;
      }).length
    : 0;

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Re-focus after sending completes
  useEffect(() => {
    if (!isSending) {
      textareaRef.current?.focus();
    }
  }, [isSending]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // Clear file error after 5 seconds
  useEffect(() => {
    if (!fileError) return;
    const t = setTimeout(() => setFileError(null), 5000);
    return () => clearTimeout(t);
  }, [fileError]);

  const handleFiles = async (files: FileList | File[]) => {
    setFileError(null);
    const fileArray = Array.from(files);

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
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isSending) return;

    const fileContext = attachments.length > 0 ? formatAttachmentsForAI(attachments) : undefined;

    onSendMessage(input.trim() || 'Please analyze the attached file(s) for my workspace setup.', fileContext);
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSending) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (isSending) return;

    const files = Array.from(e.dataTransfer.files).filter(isFileSupported);
    if (files.length > 0) {
      handleFiles(files);
    } else if (e.dataTransfer.files.length > 0) {
      setFileError('Unsupported file type. Use CSV, XLSX, TXT, MD, or JSON.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  };

  const getFileIcon = (type: FileAttachment['type']) => {
    if (type === 'csv' || type === 'xlsx') return FileSpreadsheet;
    return FileText;
  };

  const isFormFieldCollected = (key: keyof ProfileFormData): boolean => {
    if (!profileFormData) return false;
    const val = profileFormData[key];
    return !!val && val.trim().length > 0;
  };

  const getFormFieldValue = (key: keyof ProfileFormData): string | null => {
    if (!profileFormData) return null;
    const val = profileFormData[key];
    if (!val || !val.trim()) return null;
    if (key === 'workStyle') return WORK_STYLE_LABELS[val] || val;
    return val;
  };

  return (
    <div
      className={`flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pb-4 min-h-0 overflow-hidden transition-colors ${isDragOver ? 'ring-1 ring-accent/30 rounded-2xl' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto py-4 min-h-0 flex flex-col">
          {/* Spacer pushes messages to bottom when few */}
          <div className="flex-1" />
          <div className="space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'user' ? (
                /* User message - bubble style */
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent text-white px-4 py-3">
                  <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
                    {renderMarkdownLite(msg.content)}
                  </div>
                </div>
              ) : (
                /* Assistant message - flat on page, no bubble */
                <div className="w-full">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span className="text-xs font-semibold text-accent">Binee</span>
                  </div>
                  <div className="whitespace-pre-wrap text-[15px] leading-[1.7] text-text-primary">
                    {renderMarkdownLite(msg.content)}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isSending && (
            <div className="flex justify-start">
              <div className="w-full">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span className="text-xs font-semibold text-accent">Binee</span>
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input container - Claude Code style unified card */}
        <div className="shrink-0 bg-surface border border-border rounded-2xl overflow-hidden mb-1">
          {/* Top bar - discovery progress + actions, visually distinct */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-navy-dark/60">
            {/* Left: Discovery progress */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap">
                Discovery {completeness}/{PROFILE_FORM_FIELDS.length}
              </span>
              <div className="flex items-center gap-2">
                {PROFILE_FORM_FIELDS.map((field) => {
                  const collected = isFormFieldCollected(field.key);
                  const displayVal = getFormFieldValue(field.key);
                  return (
                    <div
                      key={field.key}
                      className="flex items-center gap-1"
                      title={collected && displayVal ? `${field.label}: ${displayVal}` : field.hint}
                    >
                      {collected ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      )}
                      <span className={`text-[11px] ${collected ? 'text-text-primary' : 'text-text-muted'} whitespace-nowrap`}>
                        {field.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onEditProfile}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium
                  text-text-secondary border border-border rounded-lg hover:border-accent/30 hover:text-accent
                  transition-colors whitespace-nowrap"
              >
                <Pencil className="w-3.5 h-3.5" />
                Update Info
              </button>

              {canGenerate && !isSending && (
                <button
                  onClick={() => onSendMessage('__generate_structure__')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-white font-medium text-xs
                    hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20 whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Structure
                </button>
              )}
            </div>
          </div>

          {/* File error */}
          {fileError && (
            <div className="px-4 py-1.5 border-t border-border bg-red-500/5">
              <span className="text-xs text-red-400">{fileError}</span>
            </div>
          )}

          {/* Drag overlay */}
          {isDragOver && (
            <div className="px-4 py-2 border-t border-accent/30 bg-accent/5">
              <div className="flex items-center gap-2 justify-center">
                <Paperclip className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs text-accent font-medium">
                  Drop files here (CSV, XLSX, TXT, MD, JSON)
                </span>
              </div>
            </div>
          )}

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="px-4 py-2 border-t border-border flex flex-wrap gap-2">
              {attachments.map((att, i) => {
                const Icon = getFileIcon(att.type);
                return (
                  <div
                    key={`${att.name}-${i}`}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-navy-dark border border-border text-xs text-text-secondary"
                  >
                    <Icon className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="truncate max-w-[120px]">{att.name}</span>
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

          {/* Textarea area */}
          <div className="px-4 pt-3 pb-2 border-t border-border">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                messageCount === 0
                  ? 'Describe your business, team, and how you work...'
                  : 'Tell me more about your team, tools, or workflows...'
              }
              disabled={isSending}
              rows={2}
              className="w-full resize-none bg-transparent text-[15px] text-text-primary placeholder:text-text-muted outline-none disabled:opacity-50 max-h-[200px] leading-relaxed"
            />
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || isParsing}
                  className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-navy-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
              </div>
              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || isSending}
                className="shrink-0 w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white
                  hover:bg-accent-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Markdown-lite renderer
// ---------------------------------------------------------------------------

function renderMarkdownLite(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Loader2,
  Pencil,
  Paperclip,
  X,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import type { SetupChatMessage } from '@/hooks/useSetup';
import {
  parseFile,
  parseImage,
  parseImageBlob,
  getFileError,
  isImageFile,
  isAnySupportedFile,
} from '@/lib/file-parser';
import type { FileAttachment, ImageAttachment } from '@/lib/file-parser';
import type { ImageAttachmentPayload } from '@/types/ai';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BusinessChatStepProps {
  messages: SetupChatMessage[];
  isSending: boolean;
  messageCount: number;
  /**
   * Phase 2: send the parsed attachments themselves rather than a flattened
   * fileContext blob. The hook layer uploads each one to
   * /api/setup/attachments/upload (which generates the Haiku digest and
   * persists the row) and then references them in the chat call by id.
   */
  onSendMessage: (
    msg: string,
    fileAttachments?: FileAttachment[],
    imageAttachments?: ImageAttachmentPayload[],
  ) => void;
  onEditProfile: () => void;
  /** Images uploaded in the profile form, pre-loaded into the chat input. */
  pendingImageAttachments?: ImageAttachmentPayload[];
  /** Called once the pending images have been attached to a chat message. */
  onConsumePendingImages?: () => void;
  /**
   * Multi-agent: discovery brief shown as a "What I've gathered" pinned
   * checkpoint above the input once `isReadyForGenerate` is true.
   */
  clarifierBrief?: Record<string, unknown> | null;
  /**
   * Multi-agent: true once discovery is complete. Highlights Generate
   * Structure so the user knows the next step.
   */
  isReadyForGenerate?: boolean;
}

// (Templates removed - profile form now collects business info directly)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BusinessChatStep({
  messages,
  isSending,
  messageCount,
  onSendMessage,
  onEditProfile,
  pendingImageAttachments,
  onConsumePendingImages,
  clarifierBrief,
  isReadyForGenerate,
}: BusinessChatStepProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalAttachmentCount = attachments.length + imageAttachments.length;

  const canGenerate = messageCount >= 1;

  const briefSummary =
    clarifierBrief && typeof clarifierBrief === 'object' && typeof (clarifierBrief as { summary?: unknown }).summary === 'string'
      ? ((clarifierBrief as { summary: string }).summary)
      : null;

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Pre-load images uploaded in the profile form so they get attached to
  // the next chat message the user sends. Hydrate once per pending batch.
  const hydratedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingImageAttachments || pendingImageAttachments.length === 0) return;
    const key = pendingImageAttachments.map((i) => `${i.name}:${i.base64.length}`).join('|');
    if (hydratedKey.current === key) return;
    hydratedKey.current = key;
    setImageAttachments((prev) => {
      const existingNames = new Set(prev.map((p) => p.name));
      const additions: ImageAttachment[] = pendingImageAttachments
        .filter((p) => !existingNames.has(p.name))
        .map((p) => ({
          name: p.name,
          type: 'image' as const,
          base64: p.base64,
          media_type: p.media_type,
          size: 0,
        }));
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }, [pendingImageAttachments]);

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

    if (totalAttachmentCount + fileArray.length > 3) {
      setFileError('Maximum 3 attachments per message');
      return;
    }

    for (const file of fileArray) {
      const error = getFileError(file);
      if (error) {
        setFileError(error);
        return;
      }
    }

    const imageFiles = fileArray.filter(isImageFile);
    const dataFiles = fileArray.filter((f) => !isImageFile(f));

    setIsParsing(true);
    try {
      if (dataFiles.length > 0) {
        const parsed = await Promise.all(
          dataFiles.map(async (file) => {
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
      }

      if (imageFiles.length > 0) {
        const parsedImages = await Promise.all(imageFiles.map((file) => parseImage(file)));
        setImageAttachments((prev) => [...prev, ...parsedImages]);
      }
    } catch {
      setFileError('Failed to parse file. Please try a different format.');
    } finally {
      setIsParsing(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const removeImageAttachment = (index: number) => {
    setImageAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (isSending) return;

    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((item) => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;

    e.preventDefault();

    if (totalAttachmentCount + imageItems.length > 3) {
      setFileError('Maximum 3 attachments per message');
      return;
    }

    setIsParsing(true);
    try {
      const parsedImages = await Promise.all(
        imageItems.map(async (item) => {
          const blob = item.getAsFile();
          if (!blob) throw new Error('Failed to read clipboard image');
          return parseImageBlob(blob);
        }),
      );
      setImageAttachments((prev) => [...prev, ...parsedImages]);
    } catch {
      setFileError('Failed to read clipboard image. Try saving it as a file first.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSend = () => {
    const hasAttachments = attachments.length > 0 || imageAttachments.length > 0;
    if ((!input.trim() && !hasAttachments) || isSending) return;

    const fileAttachments = attachments.length > 0 ? attachments : undefined;
    const imagePayloads: ImageAttachmentPayload[] | undefined = imageAttachments.length > 0
      ? imageAttachments.map((img) => ({
          base64: img.base64,
          media_type: img.media_type,
          name: img.name,
        }))
      : undefined;

    const fallbackPrompt = imageAttachments.length > 0
      ? 'Please analyze the attached image(s) for my workspace setup.'
      : 'Please analyze the attached file(s) for my workspace setup.';

    onSendMessage(input.trim() || fallbackPrompt, fileAttachments, imagePayloads);
    setInput('');
    setAttachments([]);
    setImageAttachments([]);
    if (imagePayloads && imagePayloads.length > 0) {
      onConsumePendingImages?.();
    }
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

    const files = Array.from(e.dataTransfer.files).filter(isAnySupportedFile);
    if (files.length > 0) {
      handleFiles(files);
    } else if (e.dataTransfer.files.length > 0) {
      setFileError('Unsupported file type. Use CSV, XLSX, TXT, MD, JSON, PNG, JPG, GIF, or WebP.');
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

  return (
    <div
      className={`flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 pb-4 min-h-0 overflow-hidden transition-colors ${isDragOver ? 'ring-1 ring-accent/30 rounded-2xl' : ''}`}
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

        {/* Multi-agent: "What I've gathered" checkpoint pinned above the
            input when discovery completes. Borrowed from the OpenAI Deep
            Research "verification" pattern - a single quiet line of context
            so the user can sanity-check what the model captured before
            clicking Generate Structure. */}
        {isReadyForGenerate && briefSummary && (
          <div className="shrink-0 mb-2 px-4 py-2.5 rounded-xl bg-accent/5 border border-accent/20 text-xs text-text-secondary">
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-accent">What I&apos;ve gathered. </span>
                <span>{briefSummary}</span>
              </div>
            </div>
          </div>
        )}

        {/* Input container - Claude Code style unified card */}
        <div className="shrink-0 bg-surface border border-border rounded-2xl overflow-hidden mb-1">
          {/* Top bar - action buttons */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-navy-dark/60">
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
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent text-white font-medium text-xs
                  hover:bg-accent-hover transition-colors whitespace-nowrap
                  ${isReadyForGenerate ? 'shadow-md shadow-accent/40 ring-2 ring-accent/30' : 'shadow-sm shadow-accent/20'}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Structure
              </button>
            )}
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
                  Drop files here (CSV, XLSX, TXT, MD, JSON, PNG, JPG, GIF, WebP)
                </span>
              </div>
            </div>
          )}

          {/* Attachment chips */}
          {(attachments.length > 0 || imageAttachments.length > 0) && (
            <div className="px-4 py-2 border-t border-border flex flex-wrap gap-2">
              {imageAttachments.map((img, i) => (
                <div
                  key={`img-${img.name}-${i}`}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-navy-dark border border-border text-xs text-text-secondary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${img.media_type};base64,${img.base64}`}
                    alt={img.name}
                    className="w-7 h-7 object-cover rounded shrink-0"
                  />
                  <span className="truncate max-w-[120px]">{img.name}</span>
                  <button
                    onClick={() => removeImageAttachment(i)}
                    className="ml-0.5 p-0.5 rounded hover:bg-border transition-colors"
                    title="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
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
              onPaste={handlePaste}
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
                  title="Attach file or image (CSV, XLSX, TXT, MD, JSON, PNG, JPG, GIF, WebP). You can also paste screenshots."
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt,.md,.json,.tsv,.png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0 && imageAttachments.length === 0) || isSending}
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
  return parts.flatMap((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return [
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>,
      ];
    }
    // Auto-bold "Generate Structure" inside plain-text segments so the user
    // can spot the call to action even when the model forgets to format it.
    return part.split(/(Generate Structure)/g).map((segment, j) => {
      if (segment === 'Generate Structure') {
        return (
          <strong key={`${i}-${j}`} className="font-semibold">
            {segment}
          </strong>
        );
      }
      return <span key={`${i}-${j}`}>{segment}</span>;
    });
  });
}

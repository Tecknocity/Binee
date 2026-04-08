'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Building2,
  Rocket,
  ShoppingCart,
  Briefcase,
  Code2,
  Loader2,
  CheckCircle2,
  Circle,
  Users,
  Wrench,
  GitBranch,
  Pencil,
} from 'lucide-react';
import type { SetupChatMessage, ProfileFormData } from '@/hooks/useSetup';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BusinessChatStepProps {
  messages: SetupChatMessage[];
  isSending: boolean;
  messageCount: number;
  profileFormData: ProfileFormData | null;
  onSendMessage: (msg: string) => void;
  onSelectTemplate: (template: string) => void;
  onEditProfile: () => void;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const TEMPLATES = [
  { key: 'agency', label: 'Agency', icon: Building2, description: 'Marketing, design, or creative agency' },
  { key: 'startup', label: 'Startup', icon: Rocket, description: 'Early-stage product company' },
  { key: 'ecommerce', label: 'E-commerce', icon: ShoppingCart, description: 'Online store or retail' },
  { key: 'consulting', label: 'Consulting', icon: Briefcase, description: 'Professional services firm' },
  { key: 'saas', label: 'SaaS', icon: Code2, description: 'Software-as-a-service company' },
] as const;

// ---------------------------------------------------------------------------
// Profile progress items
// ---------------------------------------------------------------------------

const PROFILE_FORM_FIELDS: Array<{
  key: keyof ProfileFormData;
  label: string;
  icon: typeof Building2;
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
  onSelectTemplate,
  onEditProfile,
}: BusinessChatStepProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    onSendMessage(input.trim());
    setInput('');
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
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pb-4 min-h-0 overflow-hidden">
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

        {/* Quick-start templates - shown only before first message */}
        {messageCount === 0 && (
          <div className="py-3 shrink-0">
            <p className="text-xs text-text-muted mb-2.5 text-center">
              Quick start - pick a template or describe your business below
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {TEMPLATES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => onSelectTemplate(t.key)}
                    disabled={isSending}
                    className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border text-text-secondary text-sm
                      hover:border-accent/40 hover:text-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t.description}
                  >
                    <Icon className="w-4 h-4 group-hover:text-accent transition-colors" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input container - Claude Code style unified card */}
        <div className="shrink-0 bg-surface border border-border rounded-2xl overflow-hidden mb-1">
          {/* Top bar - discovery progress + actions, visually distinct */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-navy-dark/60">
            {/* Left: Discovery progress */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-semibold text-text-secondary whitespace-nowrap">
                Discovery {completeness}/{PROFILE_FORM_FIELDS.length}
              </span>
              <div className="flex items-center gap-2.5">
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
                        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-text-muted shrink-0" />
                      )}
                      <span className={`text-xs ${collected ? 'text-text-primary' : 'text-text-muted'}`}>
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
              <p className="text-[11px] text-text-muted">
                <kbd className="px-1 py-0.5 rounded bg-navy-dark border border-border text-text-muted text-[10px]">Enter</kbd>{' '}
                to send
                <span className="mx-1.5 text-text-muted/50">|</span>
                <kbd className="px-1 py-0.5 rounded bg-navy-dark border border-border text-text-muted text-[10px]">Shift + Enter</kbd>{' '}
                for new line
              </p>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isSending}
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

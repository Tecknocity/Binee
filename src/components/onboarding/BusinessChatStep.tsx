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
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
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
      {/* Main chat area — full width */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Chat messages — flex-grow with bottom-anchored messages */}
        <div className="flex-1 overflow-y-auto py-4 min-h-0 flex flex-col">
          {/* Spacer pushes messages to bottom when few, collapses when many */}
          <div className="flex-1" />
          <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                  ${
                    msg.role === 'user'
                      ? 'bg-accent text-white rounded-br-md'
                      : 'bg-surface border border-border text-text-primary rounded-bl-md'
                  }
                `}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    <span className="text-xs font-semibold text-accent">Binee</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap">
                  {renderMarkdownLite(msg.content)}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-surface border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs font-semibold text-accent">Binee</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Quick-start templates — shown only before first message */}
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

        {/* Discovery progress strip — three-column layout above input */}
        <div className="shrink-0 bg-surface border border-border rounded-xl px-4 py-3 mb-2">
          <div className="flex items-start gap-4">
            {/* Left column: Title + count */}
            <div className="shrink-0">
              <h3 className="text-[11px] font-semibold text-text-primary uppercase tracking-wide">
                Discovery Progress
              </h3>
              <span className="text-[11px] font-medium text-accent">
                {completeness}/{PROFILE_FORM_FIELDS.length}
              </span>
            </div>

            {/* Center column: Checklist items */}
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 min-w-0">
              {PROFILE_FORM_FIELDS.map((field) => {
                const collected = isFormFieldCollected(field.key);
                const displayVal = getFormFieldValue(field.key);
                return (
                  <div
                    key={field.key}
                    className="flex items-center gap-1.5 min-w-0"
                    title={collected && displayVal ? `${field.label}: ${displayVal}` : field.hint}
                  >
                    {collected ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    )}
                    <span className={`text-xs truncate ${collected ? 'text-text-primary' : 'text-text-muted'}`}>
                      {field.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Right column: Action buttons */}
            <div className="shrink-0 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={onEditProfile}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium
                  text-text-secondary border border-border rounded-lg hover:border-accent/30 hover:text-accent
                  transition-colors whitespace-nowrap"
              >
                <Pencil className="w-3 h-3" />
                Update Information
              </button>

              {canGenerate && !isSending ? (
                <button
                  onClick={() => onSendMessage('__generate_structure__')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white font-medium text-[11px]
                    hover:bg-accent-hover transition-colors shadow-sm shadow-accent/20 whitespace-nowrap"
                >
                  <Sparkles className="w-3 h-3" />
                  Generate Structure
                </button>
              ) : (
                <div className="h-[26px]" />
              )}
            </div>
          </div>
        </div>

        {/* Input bar — pinned to bottom */}
        <div className="flex items-end gap-2 bg-surface border border-border rounded-xl px-3 py-2 shrink-0">
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
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none disabled:opacity-50 max-h-[160px]"
          />
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

        {/* Keyboard hint */}
        <p className="text-center text-[11px] text-text-muted mt-1.5">
          <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-text-muted text-[11px]">Enter</kbd>{' '}
          to send
          <span className="mx-1.5 text-text-muted/50">|</span>
          <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-text-muted text-[11px]">Shift</kbd>+
          <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-text-muted text-[11px]">Enter</kbd>{' '}
          for new line
        </p>
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

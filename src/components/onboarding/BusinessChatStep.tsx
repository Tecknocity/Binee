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
  AlertCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { SetupChatMessage, BusinessProfile } from '@/hooks/useSetup';
import { profileCompleteness } from '@/hooks/useSetup';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BusinessChatStepProps {
  messages: SetupChatMessage[];
  isSending: boolean;
  messageCount: number;
  businessProfile: BusinessProfile;
  onSendMessage: (msg: string) => void;
  onSelectTemplate: (template: string) => void;
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

const PROFILE_FIELDS: Array<{
  key: keyof BusinessProfile;
  label: string;
  icon: typeof Building2;
  hint: string;
}> = [
  {
    key: 'businessDescription',
    label: 'Business type',
    icon: Building2,
    hint: 'What does your business do?',
  },
  {
    key: 'teamSize',
    label: 'Team size',
    icon: Users,
    hint: 'How many team members?',
  },
  {
    key: 'departments',
    label: 'Departments',
    icon: GitBranch,
    hint: 'What departments exist?',
  },
  {
    key: 'tools',
    label: 'Current tools',
    icon: Wrench,
    hint: 'What tools do you use?',
  },
  {
    key: 'workflows',
    label: 'Workflows',
    icon: GitBranch,
    hint: 'What are your main workflows?',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BusinessChatStep({
  messages,
  isSending,
  messageCount,
  businessProfile,
  onSendMessage,
  onSelectTemplate,
}: BusinessChatStepProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canGenerate = messageCount >= 2;
  const completeness = profileCompleteness(businessProfile);

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

  const isFieldCollected = (key: keyof BusinessProfile): boolean => {
    const val = businessProfile[key];
    if (val === null) return false;
    if (Array.isArray(val)) return val.length > 0;
    return val.length > 0;
  };

  const [mobileProgressOpen, setMobileProgressOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 pb-4 min-h-0 overflow-hidden">
      {/* Mobile discovery progress — collapsible banner */}
      {messageCount > 0 && (
        <div className="lg:hidden shrink-0 mb-2">
          <button
            type="button"
            onClick={() => setMobileProgressOpen((v) => !v)}
            className="w-full flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-2.5"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Discovery Progress
              </span>
              <span className="text-xs font-medium text-accent">
                {completeness}/{PROFILE_FIELDS.length}
              </span>
            </div>
            {mobileProgressOpen ? (
              <ChevronUp className="w-4 h-4 text-text-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-muted" />
            )}
          </button>

          {mobileProgressOpen && (
            <div className="mt-1 bg-surface border border-border rounded-xl p-4">
              {/* Progress bar */}
              <div className="mb-3">
                <div className="h-1.5 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                    style={{ width: `${(completeness / PROFILE_FIELDS.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                {PROFILE_FIELDS.map((field) => {
                  const collected = isFieldCollected(field.key);
                  return (
                    <div key={field.key} className="flex items-start gap-2">
                      {collected ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-medium ${collected ? 'text-text-primary' : 'text-text-muted'}`}>
                          {field.label}
                        </p>
                        {collected ? (
                          <ProfileFieldValue profile={businessProfile} field={field.key} />
                        ) : (
                          <p className="text-[11px] text-text-muted italic">{field.hint}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
      {/* Main chat area — ~70% width when sidebar visible */}
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
              Quick start — pick a template or describe your business below
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

        {/* Generate Structure button */}
        {canGenerate && !isSending && (
          <div className="flex justify-center py-3 shrink-0">
            <button
              onClick={() => onSendMessage('__generate_structure__')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-medium text-sm
                hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
            >
              <Sparkles className="w-4 h-4" />
              Generate Structure
            </button>
          </div>
        )}

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

      {/* Profile progress sidebar — desktop only */}
      {messageCount > 0 && (
        <div className="hidden lg:flex flex-col w-64 shrink-0">
          <div className="sticky top-4 bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Discovery Progress
              </h3>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-text-muted">Profile completeness</span>
                <span className="text-[11px] font-medium text-accent">
                  {completeness}/{PROFILE_FIELDS.length}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                  style={{ width: `${(completeness / PROFILE_FIELDS.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Field checklist */}
            <div className="space-y-2.5">
              {PROFILE_FIELDS.map((field) => {
                const collected = isFieldCollected(field.key);
                return (
                  <div key={field.key} className="flex items-start gap-2">
                    {collected ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-medium ${
                          collected ? 'text-text-primary' : 'text-text-muted'
                        }`}
                      >
                        {field.label}
                      </p>
                      {collected ? (
                        <ProfileFieldValue profile={businessProfile} field={field.key} />
                      ) : (
                        <p className="text-[11px] text-text-muted italic">{field.hint}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hint when nearly complete */}
            {completeness >= 3 && !canGenerate && (
              <div className="mt-4 p-2.5 rounded-lg bg-accent/5 border border-accent/10">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Almost there! Share a bit more and you can generate your workspace structure.
                  </p>
                </div>
              </div>
            )}

            {canGenerate && (
              <div className="mt-4 p-2.5 rounded-lg bg-accent/10 border border-accent/20">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  <p className="text-[11px] text-accent leading-relaxed font-medium">
                    Ready to generate! Click the button below the chat or keep adding details.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile field value display
// ---------------------------------------------------------------------------

function ProfileFieldValue({
  profile,
  field,
}: {
  profile: BusinessProfile;
  field: keyof BusinessProfile;
}) {
  const val = profile[field];
  if (val === null) return null;

  if (Array.isArray(val)) {
    return (
      <p className="text-[11px] text-text-secondary truncate">
        {val.slice(0, 3).join(', ')}
        {val.length > 3 && ` +${val.length - 3}`}
      </p>
    );
  }

  // For string values (businessDescription, teamSize), show a truncated version
  if (field === 'teamSize') {
    return <p className="text-[11px] text-text-secondary">{val} people</p>;
  }

  return (
    <p className="text-[11px] text-text-secondary truncate" title={val}>
      {val.length > 40 ? `${val.slice(0, 40)}...` : val}
    </p>
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

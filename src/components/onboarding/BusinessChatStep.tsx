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
}: BusinessChatStepProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canGenerate = messageCount >= 2;
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

  const [mobileProgressOpen, setMobileProgressOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Mobile discovery progress - collapsible banner */}
      {messageCount > 0 && (
        <div className="lg:hidden shrink-0 px-4 pt-2 pb-1">
          <button
            type="button"
            onClick={() => setMobileProgressOpen((v) => !v)}
            className="w-full flex items-center justify-between bg-[#12121A] border border-[#2A2A3A] rounded-xl px-4 py-2.5"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#854DF9]" />
              <span className="text-xs font-semibold text-[#F0F0F5] uppercase tracking-wide">
                Discovery Progress
              </span>
              <span className="text-xs font-medium text-[#854DF9]">
                {completeness}/{PROFILE_FORM_FIELDS.length}
              </span>
            </div>
            {mobileProgressOpen ? (
              <ChevronUp className="w-4 h-4 text-[#6B6B80]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#6B6B80]" />
            )}
          </button>

          {mobileProgressOpen && (
            <div className="mt-1 bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4">
              {/* Progress bar */}
              <div className="mb-3">
                <div className="h-1.5 rounded-full bg-[#2A2A3A] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#854DF9] transition-all duration-500 ease-out"
                    style={{ width: `${(completeness / PROFILE_FORM_FIELDS.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                {PROFILE_FORM_FIELDS.map((field) => {
                  const collected = isFormFieldCollected(field.key);
                  const displayVal = getFormFieldValue(field.key);
                  return (
                    <div key={field.key} className="flex items-start gap-2">
                      {collected ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-[#6B6B80] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-medium ${collected ? 'text-[#F0F0F5]' : 'text-[#6B6B80]'}`}>
                          {field.label}
                        </p>
                        {collected && displayVal ? (
                          <p className="text-[11px] text-[#A0A0B5] truncate" title={displayVal}>
                            {displayVal.length > 50 ? `${displayVal.slice(0, 50)}...` : displayVal}
                          </p>
                        ) : (
                          <p className="text-[11px] text-[#6B6B80] italic">{field.hint}</p>
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

      {/* Main layout: chat + sidebar */}
      <div className="flex-1 flex min-h-0 overflow-hidden px-4 pb-4 gap-4">
        {/* Chat column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 max-w-4xl mx-auto w-full">
          {/* Chat messages - scrollable area */}
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col py-4">
            {/* Spacer pushes messages to bottom when few */}
            <div className="flex-1" />
            <div className="space-y-4 max-w-3xl mx-auto w-full">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`
                      max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                      ${
                        msg.role === 'user'
                          ? 'bg-[#854DF9] text-white rounded-br-md'
                          : 'bg-[#12121A] border border-[#2A2A3A] text-[#F0F0F5] rounded-bl-md'
                      }
                    `}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#854DF9]" />
                        <span className="text-xs font-semibold text-[#854DF9]">Binee</span>
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
                  <div className="bg-[#12121A] border border-[#2A2A3A] rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#854DF9]" />
                      <span className="text-xs font-semibold text-[#854DF9]">Binee</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6B6B80] animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6B6B80] animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6B6B80] animate-bounce [animation-delay:300ms]" />
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
              <p className="text-xs text-[#6B6B80] mb-2.5 text-center">
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
                      className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#12121A] border border-[#2A2A3A] text-[#A0A0B5] text-sm
                        hover:border-[#854DF9]/40 hover:text-[#854DF9] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t.description}
                    >
                      <Icon className="w-4 h-4 group-hover:text-[#854DF9] transition-colors" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generate Structure button - sticky and prominent */}
          {canGenerate && !isSending && (
            <div className="flex justify-center py-3 shrink-0">
              <button
                onClick={() => onSendMessage('__generate_structure__')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#854DF9] text-white font-semibold text-sm
                  hover:bg-[#9D6FFA] transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Generate Structure
              </button>
            </div>
          )}

          {/* Input bar */}
          <div className="shrink-0">
            <div className="flex items-end gap-2 bg-[#12121A] border border-[#2A2A3A] rounded-xl px-3 py-2">
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
                className="flex-1 resize-none bg-transparent text-sm text-[#F0F0F5] placeholder:text-[#6B6B80] outline-none disabled:opacity-50 max-h-[160px]"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isSending}
                className="shrink-0 w-8 h-8 rounded-lg bg-[#854DF9] flex items-center justify-center text-white
                  hover:bg-[#9D6FFA] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            {/* Keyboard hint */}
            <p className="text-center text-[11px] text-[#6B6B80] mt-1.5">
              <kbd className="px-1 py-0.5 rounded bg-[#12121A] border border-[#2A2A3A] text-[#6B6B80] text-[11px]">Enter</kbd>{' '}
              to send
              <span className="mx-1.5 text-[#6B6B80]/50">|</span>
              <kbd className="px-1 py-0.5 rounded bg-[#12121A] border border-[#2A2A3A] text-[#6B6B80] text-[11px]">Shift</kbd>+
              <kbd className="px-1 py-0.5 rounded bg-[#12121A] border border-[#2A2A3A] text-[#6B6B80] text-[11px]">Enter</kbd>{' '}
              for new line
            </p>
          </div>
        </div>

        {/* Profile progress sidebar - desktop only, fixed width */}
        {messageCount > 0 && (
          <div className="hidden lg:block w-60 shrink-0">
            <div className="sticky top-0 bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-[#854DF9]" />
                <h3 className="text-xs font-semibold text-[#F0F0F5] uppercase tracking-wide">
                  Discovery Progress
                </h3>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[#6B6B80]">Profile completeness</span>
                  <span className="text-[11px] font-medium text-[#854DF9]">
                    {completeness}/{PROFILE_FORM_FIELDS.length}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#2A2A3A] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#854DF9] transition-all duration-500 ease-out"
                    style={{ width: `${(completeness / PROFILE_FORM_FIELDS.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Field checklist */}
              <div className="space-y-2.5">
                {PROFILE_FORM_FIELDS.map((field) => {
                  const collected = isFormFieldCollected(field.key);
                  const displayVal = getFormFieldValue(field.key);
                  return (
                    <div key={field.key} className="flex items-start gap-2">
                      {collected ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-[#6B6B80] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-medium ${
                            collected ? 'text-[#F0F0F5]' : 'text-[#6B6B80]'
                          }`}
                        >
                          {field.label}
                        </p>
                        {collected && displayVal ? (
                          <p className="text-[11px] text-[#A0A0B5] truncate" title={displayVal}>
                            {displayVal.length > 50 ? `${displayVal.slice(0, 50)}...` : displayVal}
                          </p>
                        ) : (
                          <p className="text-[11px] text-[#6B6B80] italic">{field.hint}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hint when nearly complete */}
              {completeness >= 2 && !canGenerate && (
                <div className="mt-4 p-2.5 rounded-lg bg-[#854DF9]/5 border border-[#854DF9]/10">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-[#854DF9] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#A0A0B5] leading-relaxed">
                      Almost there! Share a bit more and you can generate your workspace structure.
                    </p>
                  </div>
                </div>
              )}

              {canGenerate && (
                <div className="mt-4 p-2.5 rounded-lg bg-[#854DF9]/10 border border-[#854DF9]/20">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#854DF9] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#854DF9] leading-relaxed font-medium">
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

'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Building2, Rocket, ShoppingCart, Briefcase, Code2, Loader2 } from 'lucide-react';
import type { SetupChatMessage } from '@/hooks/useSetup';

interface BusinessChatStepProps {
  messages: SetupChatMessage[];
  isSending: boolean;
  messageCount: number;
  onSendMessage: (msg: string) => void;
  onSelectTemplate: (template: string) => void;
}

const TEMPLATES = [
  { key: 'agency', label: 'Agency', icon: Building2 },
  { key: 'startup', label: 'Startup', icon: Rocket },
  { key: 'ecommerce', label: 'E-commerce', icon: ShoppingCart },
  { key: 'consulting', label: 'Consulting', icon: Briefcase },
  { key: 'saas', label: 'SaaS', icon: Code2 },
] as const;

export function BusinessChatStep({
  messages,
  isSending,
  messageCount,
  onSendMessage,
  onSelectTemplate,
}: BusinessChatStepProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Show generate button after 2+ user messages
  const canGenerate = messageCount >= 2;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pb-6">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
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

      {/* Quick-start templates */}
      {messageCount === 0 && (
        <div className="py-3">
          <p className="text-xs text-text-muted mb-2 text-center">Quick start</p>
          <div className="flex flex-wrap justify-center gap-2">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => onSelectTemplate(t.key)}
                  disabled={isSending}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border text-text-secondary text-sm
                    hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Generate button */}
      {canGenerate && !isSending && (
        <div className="flex justify-center py-3">
          <button
            onClick={() => onSendMessage('__generate_structure__')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-medium text-sm
              hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
          >
            <Sparkles className="w-4 h-4" />
            Generate Structure
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your business..."
          disabled={isSending}
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isSending}
          className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white
            hover:bg-accent/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Very simple markdown-lite renderer for bold text and line breaks.
 */
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

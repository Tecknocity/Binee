import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MockResponse {
  text: string;
  suggestedFollowups: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  suggestedFollowups?: string[];
  feedback?: 'up' | 'down' | null;
  copiedAt?: number | null;
}

interface ConversationSummary {
  id: string;
  title: string;
  date: string;
  preview: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_RESPONSES: MockResponse[] = [
  {
    text: `Your overall business health score is **82/100** — that's in the **healthy** range! Here's the breakdown:\n- Revenue Growth: **\\u219112.5%** MoM — Strong\n- Pipeline Coverage: **2.8x** — Adequate (aim for 3x+)\n- Team Utilization: **78%** — Good\n- Cash Runway: **14 months** — Comfortable\n\nThe main area needing attention is pipeline coverage — you're slightly below the 3x benchmark.`,
    suggestedFollowups: [
      'How can I improve pipeline coverage?',
      'Show me revenue trends',
      "What's my churn rate?",
    ],
  },
  {
    text: `I found **3 deals at risk** in your pipeline worth a total of **$115,000**:\n1. **TechStart Inc** — $38,000 — Stuck in Proposal for 21 days\n2. **Beta Systems** — $32,000 — Stuck in Proposal for 28 days\n3. **Global Services** — $45,000 — No activity for 15 days\n\nRecommended action: Schedule follow-ups for TechStart and Beta Systems this week. The average deal cycle is 45 days, and these are exceeding that.`,
    suggestedFollowups: [
      'Show me all pipeline deals',
      "What's the average close rate?",
      'Draft follow-up emails',
    ],
  },
  {
    text: `Your current cash runway is **14 months** based on:\n- Cash on hand: **$247,500**\n- Monthly burn rate: **$17,500** (avg of last 3 months)\n- MRR: **$32,450** \\u219112.5%\n\nAt your current growth rate, you'll become cash-flow positive in approximately **4 months**. Your runway is extending by ~0.5 months each month due to revenue growth outpacing expenses.`,
    suggestedFollowups: [
      'Show expense breakdown',
      "What's my path to profitability?",
      'How does this compare to benchmarks?',
    ],
  },
  {
    text: `Based on your current data, here's what I'd focus on this week:\n\n1. **Follow up on 3 stuck deals** ($115K at risk) — These have been idle for 15-28 days\n2. **Review 8 overdue tasks** — Your team has tasks overdue by 7+ days in ClickUp\n3. **Clean up 15 deals missing amounts** — This is hurting your revenue forecast accuracy\n4. **Check Product Launch project** — Budget is 84% spent but only 40% complete\n\nQuick win: Add missing deal amounts in HubSpot (~30 min) to improve forecast accuracy by ~20%.`,
    suggestedFollowups: [
      'Tell me more about the Product Launch',
      'How do I improve forecast accuracy?',
      'Show team performance',
    ],
  },
  {
    text: `Great question! Based on your connected data from **HubSpot**, **Stripe**, **QuickBooks**, and **ClickUp**:\n\nYour business is performing **above average** in most areas. Key highlights:\n- **MRR**: $32,450 (\\u219112.5% MoM)\n- **Customer count**: 127 (\\u21915 this month)\n- **Active projects**: 12 (3 on track, 1 at risk)\n- **Team utilization**: 78%\n\nI'd recommend focusing on improving your pipeline coverage from 2.8x to 3x+ to ensure sustained growth.`,
    suggestedFollowups: [
      'Set a goal for pipeline coverage',
      'Show me customer trends',
      'Compare to last quarter',
    ],
  },
];

const STARTER_QUESTIONS = [
  {
    text: "What's my business health score?",
    icon: TrendingUp,
    description: 'Overall performance metrics across all integrations',
  },
  {
    text: 'Which deals are at risk?',
    icon: AlertTriangle,
    description: 'Pipeline deals needing immediate attention',
  },
  {
    text: "How's my cash runway?",
    icon: DollarSign,
    description: 'Financial health and runway projections',
  },
  {
    text: 'What should I focus on this week?',
    icon: Target,
    description: 'AI-prioritized action items for the week',
  },
];

const MOCK_CONVERSATIONS: ConversationSummary[] = [
  {
    id: 'conv-1',
    title: 'Business Health Review',
    date: 'Today',
    preview: 'Your health score is 82/100...',
  },
  {
    id: 'conv-2',
    title: 'Pipeline Risk Analysis',
    date: 'Yesterday',
    preview: '3 deals at risk worth $115K...',
  },
  {
    id: 'conv-3',
    title: 'Cash Flow Projection',
    date: 'Feb 14',
    preview: '14 months runway, cash-flow positive in 4...',
  },
  {
    id: 'conv-4',
    title: 'Weekly Focus Areas',
    date: 'Feb 12',
    preview: 'Follow up on stuck deals, review overdue tasks...',
  },
];

// ---------------------------------------------------------------------------
// Markdown-like renderer (lightweight, no dependency)
// ---------------------------------------------------------------------------

function renderFormattedText(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      elements.push(<br key={`br-${lineIdx}`} />);
    }

    // Detect ordered list items: "1. **...**"
    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    // Detect unordered list items: "- ..."
    const unorderedMatch = line.match(/^-\s+(.*)$/);

    if (orderedMatch) {
      elements.push(
        <span key={`li-${lineIdx}`} className="flex gap-2 items-start py-0.5">
          <span className="text-primary font-semibold min-w-[1.25rem] text-right">{orderedMatch[1]}.</span>
          <span className="flex-1">{renderInline(orderedMatch[2])}</span>
        </span>
      );
    } else if (unorderedMatch) {
      elements.push(
        <span key={`ul-${lineIdx}`} className="flex gap-2 items-start py-0.5">
          <span className="text-primary mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
          <span className="flex-1">{renderInline(unorderedMatch[1])}</span>
        </span>
      );
    } else {
      elements.push(
        <span key={`p-${lineIdx}`}>{renderInline(line)}</span>
      );
    }
  });

  return elements;
}

function renderInline(text: string): React.ReactNode[] {
  // Handle **bold** segments
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={`b-${match.index}`} className="font-semibold text-foreground">
        {match[1]}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Typing indicator
// ---------------------------------------------------------------------------

const TypingIndicator: React.FC = () => (
  <div className="flex items-start gap-3 mr-auto max-w-[80%] animate-fade-in">
    {/* Avatar */}
    <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-md mt-1">
      <Sparkles size={14} className="text-white" />
    </div>
    <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-[bounce_1.4s_ease-in-out_infinite]" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// ChatPage component
// ---------------------------------------------------------------------------

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [responseIndex, setResponseIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleSendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputValue('');
      setIsTyping(true);

      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }

      // Simulate AI response after 1.5s
      const currentIdx = responseIndex;
      setTimeout(() => {
        const mockResp = MOCK_RESPONSES[currentIdx % MOCK_RESPONSES.length];
        const aiMsg: ChatMessage = {
          id: `msg-${Date.now()}-ai`,
          role: 'ai',
          content: mockResp.text,
          timestamp: new Date(),
          suggestedFollowups: mockResp.suggestedFollowups,
          feedback: null,
          copiedAt: null,
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
        setResponseIndex((prev) => prev + 1);
      }, 1500);
    },
    [isTyping, responseIndex]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const handleCopy = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content.replace(/\*\*/g, ''));
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback noop
    }
  };

  const handleFeedback = (msgId: string, type: 'up' | 'down') => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, feedback: m.feedback === type ? null : type } : m
      )
    );
  };

  const handleStarterClick = (text: string) => {
    handleSendMessage(text);
  };

  const handleNewChat = () => {
    setMessages([]);
    setResponseIndex(0);
    setIsTyping(false);
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    // Auto-resize textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isEmpty = messages.length === 0;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex h-[calc(100vh-0px)] bg-background text-foreground overflow-hidden">
      {/* ============================================================== */}
      {/* Conversation History Sidebar                                    */}
      {/* ============================================================== */}
      <aside
        className={cn(
          'flex-shrink-0 bg-card/50 backdrop-blur-xl border-r border-border/40 flex flex-col transition-all duration-300 overflow-hidden',
          sidebarOpen ? 'w-[280px]' : 'w-0'
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/30 min-w-[280px]">
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Conversations</h2>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
          >
            <Plus size={14} />
            New
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-1 min-w-[280px]">
          {MOCK_CONVERSATIONS.map((conv, idx) => (
            <button
              key={conv.id}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-lg transition-colors group',
                idx === 0
                  ? 'bg-primary/10 border border-primary/20'
                  : 'hover:bg-muted/50'
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={cn(
                    'text-sm font-medium truncate',
                    idx === 0 ? 'text-primary' : 'text-foreground'
                  )}
                >
                  {conv.title}
                </span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                  {conv.date}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{conv.preview}</p>
            </button>
          ))}
        </div>

        {/* Sidebar footer */}
        <div className="px-4 py-3 border-t border-border/30 min-w-[280px]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles size={12} className="text-primary" />
            <span>Powered by Binee AI</span>
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* Main Chat Area                                                  */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-xl flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center shadow-sm">
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">Binee AI Assistant</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Ask anything about your business data
              </p>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* Messages container                                            */}
        {/* ============================================================ */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto custom-scrollbar"
        >
          <div className="max-w-3xl mx-auto px-4 py-6">
            {/* -------------------------------------------------------- */}
            {/* Empty state: starter questions                            */}
            {/* -------------------------------------------------------- */}
            {isEmpty && !isTyping && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
                {/* Hero */}
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-glow mb-6">
                  <Sparkles size={28} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-1">
                  How can I help you today?
                </h2>
                <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
                  I can analyze your business data from HubSpot, Stripe, QuickBooks, and ClickUp to give you actionable insights.
                </p>

                {/* Starter question cards */}
                <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                  {STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q.text}
                      onClick={() => handleStarterClick(q.text)}
                      className="flex flex-col items-start gap-2 p-4 bg-card border border-border hover:border-primary/40 hover:bg-primary/5 rounded-xl transition-all duration-200 text-left group card-hover"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                        <q.icon size={16} className="text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground leading-snug">
                        {q.text}
                      </span>
                      <span className="text-[11px] text-muted-foreground leading-snug">
                        {q.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* Messages                                                  */}
            {/* -------------------------------------------------------- */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'mb-5 flex animate-slide-up',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {/* AI avatar */}
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-md mt-1 mr-3">
                    <Sparkles size={14} className="text-white" />
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[80%] group',
                    msg.role === 'user' ? 'ml-auto' : 'mr-auto'
                  )}
                >
                  {/* Bubble */}
                  <div
                    className={cn(
                      'px-4 py-3 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-primary/15 border border-primary/20 rounded-2xl rounded-br-sm text-foreground'
                        : 'bg-card border border-border rounded-2xl rounded-bl-sm text-foreground/90'
                    )}
                  >
                    {msg.role === 'ai' ? (
                      <div className="space-y-1">{renderFormattedText(msg.content)}</div>
                    ) : (
                      msg.content
                    )}
                  </div>

                  {/* AI message meta row */}
                  {msg.role === 'ai' && (
                    <div className="flex items-center gap-1 mt-1.5 px-1">
                      {/* Timestamp / source */}
                      <span className="text-[10px] text-muted-foreground mr-auto">
                        Data as of {formatTime(msg.timestamp)}
                      </span>

                      {/* Copy */}
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                        title="Copy response"
                      >
                        {copiedId === msg.id ? (
                          <Check size={13} className="text-success" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>

                      {/* Thumbs up */}
                      <button
                        onClick={() => handleFeedback(msg.id, 'up')}
                        className={cn(
                          'p-1 rounded-md transition-colors',
                          msg.feedback === 'up'
                            ? 'text-success bg-success/10'
                            : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/50'
                        )}
                        title="Helpful"
                      >
                        <ThumbsUp size={13} />
                      </button>

                      {/* Thumbs down */}
                      <button
                        onClick={() => handleFeedback(msg.id, 'down')}
                        className={cn(
                          'p-1 rounded-md transition-colors',
                          msg.feedback === 'down'
                            ? 'text-destructive bg-destructive/10'
                            : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/50'
                        )}
                        title="Not helpful"
                      >
                        <ThumbsDown size={13} />
                      </button>
                    </div>
                  )}

                  {/* User message timestamp */}
                  {msg.role === 'user' && (
                    <div className="flex justify-end mt-1 px-1">
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  )}

                  {/* Suggested follow-ups */}
                  {msg.role === 'ai' && msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 px-1">
                      {msg.suggestedFollowups.map((q) => (
                        <button
                          key={q}
                          onClick={() => handleSendMessage(q)}
                          disabled={isTyping}
                          className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && <TypingIndicator />}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ============================================================ */}
        {/* Input bar                                                     */}
        {/* ============================================================ */}
        <div className="sticky bottom-0 border-t border-border bg-card/80 backdrop-blur-xl px-4 py-3 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 bg-background border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 rounded-xl px-3 py-2 transition-all duration-200">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your business..."
                rows={1}
                disabled={isTyping}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 resize-none outline-none max-h-40 py-1 disabled:opacity-50"
              />
              <button
                onClick={() => handleSendMessage(inputValue)}
                disabled={!inputValue.trim() || isTyping}
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 flex-shrink-0',
                  inputValue.trim() && !isTyping
                    ? 'gradient-primary text-white shadow-sm hover:shadow-md'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
                title="Send message"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">
              Press Enter to send &middot; Shift+Enter for new line &middot; Binee AI may produce inaccurate information
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;

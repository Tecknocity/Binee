'use client';

import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import type { Conversation } from '@/hooks/useConversations';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header + New Chat */}
      <div className="px-3 pt-4 pb-2">
        <button
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {conversations.map((conv) => {
          const isActive = conv.id === activeId;
          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`group w-full text-left px-3 py-2.5 rounded-xl transition-colors relative ${
                isActive
                  ? 'bg-surface border border-border'
                  : 'hover:bg-surface-hover/40 border border-transparent'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <MessageSquare
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    isActive ? 'text-accent' : 'text-text-muted'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium truncate ${
                      isActive ? 'text-text-primary' : 'text-text-secondary'
                    }`}
                  >
                    {conv.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-muted truncate">
                      {formatRelativeDate(conv.updatedAt)}
                    </span>
                    <span className="text-xs text-text-muted">
                      {conv.messageCount} msg{conv.messageCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Delete button (hover reveal) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all"
                  title="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </button>
          );
        })}

        {conversations.length === 0 && (
          <div className="text-center py-8 px-4">
            <p className="text-sm text-text-muted">No conversations yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, MessageSquare } from 'lucide-react';
import { useSharedConversations } from '@/contexts/ConversationsContext';
import { cn } from '@/lib/utils';

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `Last message ${diffHours} hours ago`;
  if (diffDays === 1) return 'Last message 1 day ago';
  if (diffDays < 7) return `Last message ${diffDays} days ago`;
  return `Last message ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export default function ChatsPage() {
  const router = useRouter();
  const {
    conversations,
    createConversation,
  } = useSharedConversations();

  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const handleSelectConversation = (id: string) => {
    // Navigate directly to the conversation URL.
    // The route component (/chat/[id]) will sync the context for sidebar highlight.
    router.push(`/chat/${id}`);
  };

  const handleNewChat = () => {
    createConversation();
    router.push('/chat');
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Chats</h1>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your chats..."
          className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors"
          autoFocus
        />
      </div>

      {/* Label */}
      <p className="text-sm text-text-muted mb-3 px-1">
        Your chats with Binee
        {searchQuery && ` matching "${searchQuery}"`}
      </p>

      {/* Chat list */}
      <div className="space-y-1">
        {filteredConversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => handleSelectConversation(conv.id)}
            className="w-full text-left px-4 py-4 rounded-xl hover:bg-surface-hover transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                  {conv.title}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {formatRelativeDate(conv.updatedAt)}
                </p>
              </div>
            </div>
          </button>
        ))}

        {filteredConversations.length === 0 && (
          <div className="text-center py-16">
            <MessageSquare className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
            <p className="text-text-muted text-sm">
              {searchQuery ? 'No chats match your search' : 'No chats yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleNewChat}
                className="mt-4 text-sm text-accent hover:text-accent-hover transition-colors"
              >
                Start a new chat
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

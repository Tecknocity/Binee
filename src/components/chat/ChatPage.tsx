'use client';

import { useState, useCallback, useEffect } from 'react';
import { PanelLeftOpen, X } from 'lucide-react';
import { useConversations } from '@/hooks/useConversations';
import { useChat } from '@/hooks/useChat';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';
import ChatInput from './ChatInput';
import EmptyState from './EmptyState';

export default function ChatPage() {
  const {
    conversations,
    activeConversationId,
    createConversation,
    deleteConversation,
    setActiveConversation,
  } = useConversations();

  const {
    messages,
    isLoading,
    sendMessage,
    confirmAction,
    loadConversation,
  } = useChat(activeConversationId);

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load messages when active conversation changes
  useEffect(() => {
    loadConversation(activeConversationId);
  }, [activeConversationId, loadConversation]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversation(id);
      setSidebarOpen(false);
    },
    [setActiveConversation],
  );

  const handleCreateConversation = useCallback(() => {
    createConversation();
    setSidebarOpen(false);
  }, [createConversation]);

  const handleSuggestedPrompt = useCallback(
    (prompt: string) => {
      if (!activeConversationId) {
        createConversation();
      }
      sendMessage(prompt);
    },
    [activeConversationId, createConversation, sendMessage],
  );

  const handleSend = useCallback(
    (content: string) => {
      if (!activeConversationId) {
        createConversation();
      }
      sendMessage(content);
    },
    [activeConversationId, createConversation, sendMessage],
  );

  const handleConfirmAction = useCallback(
    (id: string) => confirmAction(id, true),
    [confirmAction],
  );

  const handleCancelAction = useCallback(
    (id: string) => confirmAction(id, false),
    [confirmAction],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen overflow-hidden bg-navy-base">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — conversation list */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-72 bg-navy-dark border-r border-border/50
          transform transition-transform duration-200 ease-out
          lg:static lg:translate-x-0 lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Mobile close */}
        <div className="flex items-center justify-between px-4 pt-4 lg:hidden">
          <span className="text-sm font-medium text-text-primary">Chats</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onCreate={handleCreateConversation}
          onDelete={deleteConversation}
        />
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border/50 shrink-0 bg-navy-base/50 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted lg:hidden"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-medium text-text-primary truncate">
            {activeConversationId
              ? conversations.find((c) => c.id === activeConversationId)?.title ?? 'New conversation'
              : 'Start a conversation'}
          </h2>
        </div>

        {/* Messages or empty state */}
        {hasMessages ? (
          <MessageThread
            messages={messages}
            isLoading={isLoading}
            onConfirmAction={handleConfirmAction}
            onCancelAction={handleCancelAction}
          />
        ) : (
          <EmptyState
            variant="no-conversations"
            onSuggestedPrompt={handleSuggestedPrompt}
          />
        )}

        {/* Input — always visible */}
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          placeholder={!activeConversationId ? 'Start a new conversation...' : undefined}
        />
      </main>
    </div>
  );
}

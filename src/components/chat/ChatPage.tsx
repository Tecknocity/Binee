'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useConversations } from '@/hooks/useConversations';
import { useChat } from '@/hooks/useChat';
import type { DashboardChoiceData } from '@/hooks/useChat';
import { useAuth } from '@/components/auth/AuthProvider';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import MessageThread from './MessageThread';
import ChatInput from './ChatInput';
import OutOfCreditsModal from '@/components/credits/OutOfCreditsModal';
import UpgradePrompt from '@/components/credits/UpgradePrompt';
import { Hexagon } from 'lucide-react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

const SUGGESTED_PROMPTS = [
  { text: 'Show me all overdue tasks', icon: '🔴' },
  { text: "Summarize this week's progress", icon: '📊' },
  { text: 'What are the top priorities for today?', icon: '🎯' },
  { text: 'Build a dashboard for team performance', icon: '📈' },
];

export default function ChatPage() {
  const { user } = useAuth();
  const { credit_balance, workspace, loading: wsLoading, error: wsError } = useWorkspaceContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isNew = searchParams.get('new') === '1';
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const isOutOfCredits = credit_balance <= 0;

  // Show error state when workspace setup failed
  if (!wsLoading && !workspace && user) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-navy-base items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-error/15 flex items-center justify-center mx-auto">
            <Hexagon className="w-6 h-6 text-error" />
          </div>
          <h2 className="text-lg font-medium text-text-primary">Workspace Setup Needed</h2>
          <p className="text-sm text-text-secondary">
            {wsError || 'Your workspace could not be created. This usually means the database needs to be set up.'}
          </p>
          <p className="text-xs text-text-muted">
            Try signing out and back in. If the problem persists, check the browser console for errors
            or visit <span className="font-mono text-accent">/api/auth/debug</span> for diagnostics.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const {
    activeConversationId,
    createConversation,
    setActiveConversation,
  } = useConversations();

  // When ?new=1 is in URL, clear the active conversation so we show the welcome screen
  useEffect(() => {
    if (isNew) {
      setActiveConversation(null);
      // Clean up the URL without re-rendering
      router.replace('/chat', { scroll: false });
    }
  }, [isNew, setActiveConversation, router]);

  // If we're in "new" mode, treat activeConversationId as null
  const effectiveConversationId = isNew ? null : activeConversationId;

  const {
    messages,
    isLoading,
    sendMessage,
    confirmAction,
    selectDashboardChoice,
    loadConversation,
  } = useChat(effectiveConversationId);

  useEffect(() => {
    loadConversation(effectiveConversationId);
  }, [effectiveConversationId, loadConversation]);

  const handleSend = useCallback(
    (content: string) => {
      if (isOutOfCredits) {
        setShowCreditsModal(true);
        return;
      }

      if (!activeConversationId) {
        const newId = createConversation();
        // sendMessage needs the conversation to exist, but since hook state
        // won't update until next render, we call it directly
        sendMessage(content, newId);
      } else {
        sendMessage(content);
      }
    },
    [activeConversationId, createConversation, sendMessage, isOutOfCredits],
  );

  const handleSuggestedPrompt = useCallback(
    (prompt: string) => {
      handleSend(prompt);
    },
    [handleSend],
  );

  const handleConfirmAction = useCallback(
    (id: string) => confirmAction(id, true),
    [confirmAction],
  );

  const handleCancelAction = useCallback(
    (id: string) => confirmAction(id, false),
    [confirmAction],
  );

  const handleDashboardChoice = useCallback(
    (messageId: string, choice: DashboardChoiceData) => {
      selectDashboardChoice(messageId, choice.id);
      // Send the user's choice as a follow-up message so AI can act on it
      if (choice.type === 'new_dashboard') {
        handleSend('Create a new dashboard for this.');
      } else if (choice.dashboardName) {
        handleSend(`Add it to the "${choice.dashboardName}" dashboard.`);
      }
    },
    [selectDashboardChoice, handleSend],
  );

  const hasMessages = messages.length > 0;
  const firstName = user?.display_name?.split(' ')[0] || 'there';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-navy-base">
      {hasMessages ? (
        <>
          <MessageThread
            messages={messages}
            isLoading={isLoading}
            onConfirmAction={handleConfirmAction}
            onCancelAction={handleCancelAction}
            onDashboardChoice={handleDashboardChoice}
          />
          {isOutOfCredits ? (
            <UpgradePrompt />
          ) : (
            <ChatInput
              onSend={handleSend}
              disabled={isLoading}
            />
          )}
        </>
      ) : (
        <>
          {/* Claude-style welcome */}
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                <Hexagon className="w-5 h-5 text-accent" />
              </div>
              <h1 className="text-2xl font-light text-text-primary">
                {getGreeting()}, {firstName}
              </h1>
            </div>

            {/* Chat input - centered */}
            <div className="w-full max-w-2xl mb-8">
              {isOutOfCredits ? (
                <UpgradePrompt />
              ) : (
                <ChatInput
                  onSend={handleSend}
                  disabled={isLoading}
                  placeholder="Start a new chat..."
                />
              )}
            </div>

            {/* Suggested prompts - hide when out of credits */}
            {!isOutOfCredits && (
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.text}
                    onClick={() => handleSuggestedPrompt(prompt.text)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border hover:border-accent/30 hover:bg-surface-hover transition-all duration-150 text-sm text-text-secondary hover:text-text-primary"
                  >
                    <span>{prompt.icon}</span>
                    <span>{prompt.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <OutOfCreditsModal
        open={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
      />
    </div>
  );
}

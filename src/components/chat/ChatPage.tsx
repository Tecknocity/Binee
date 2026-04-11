'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSharedConversations } from '@/contexts/ConversationsContext';
import { useConversationUI } from '@/stores/conversationUI';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/components/auth/AuthProvider';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import MessageThread from './MessageThread';
import ChatInput from './ChatInput';
import EmptyState from './EmptyState';
import type { EmptyStateVariant } from './EmptyState';
import WelcomeMessage from './WelcomeMessage';
import ChatHeader from './ChatHeader';
import OutOfCreditsModal from '@/components/credits/OutOfCreditsModal';
import UpgradePrompt from '@/components/credits/UpgradePrompt';
import { Hexagon, Loader2 } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';


/**
 * Interactive workspace setup error screen.
 * Attempts to create the workspace via ensure-owner API and shows
 * exactly what's happening / what's failing.
 */
function WorkspaceSetupError({ wsError, user }: { wsError: string | null; user: { id: string; email: string; display_name: string } }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const { signOut } = useAuth();

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  const handleCreateWorkspace = async () => {
    setStatus('loading');
    setLogs([]);
    addLog('Starting workspace setup...');

    const supabase = createBrowserClient();

    // Step 1: Try ensure-owner API
    addLog('Step 1: Calling /api/workspace/ensure-owner...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        addLog('WARNING: No access token found in session');
      }

      const res = await fetch('/api/workspace/ensure-owner', {
        method: 'POST',
        headers,
      });
      const body = await res.json().catch(() => ({}));
      addLog(`ensure-owner response: ${res.status} ${JSON.stringify(body)}`);

      if (res.ok) {
        addLog('Step 2: Loading workspaces...');
        let memberRows = null;
        const attempt = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .in('status', ['active', 'pending']);

        if (attempt.error && attempt.error.message.includes('status')) {
          addLog('status column not found, retrying without filter...');
          const fallback = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id);
          memberRows = fallback.data;
          if (fallback.error) addLog(`workspace_members query FAILED: ${fallback.error.message}`);
        } else {
          memberRows = attempt.data;
          if (attempt.error) addLog(`workspace_members query FAILED: ${attempt.error.message}`);
        }

        if (memberRows) addLog(`Found ${memberRows.length} workspace memberships`);

        if (memberRows && memberRows.length > 0) {
          addLog('Workspace created successfully! Reloading...');
          setStatus('success');
          setTimeout(() => window.location.reload(), 1000);
          return;
        }
      }
    } catch (err) {
      addLog(`ensure-owner network error: ${err}`);
    }

    // Step 2: Try client-side creation directly
    addLog('Step 2: Trying client-side workspace creation...');
    try {
      const displayName = user.display_name || 'User';
      const slug = (displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'my-workspace') + '-' + Date.now().toString(36);

      addLog(`Creating workspace: "${displayName}'s Workspace" (slug: ${slug})`);
      const { data: newWs, error: wsErr } = await supabase
        .from('workspaces')
        .insert({
          name: `${displayName}'s Workspace`,
          slug,
          owner_id: user.id,
          plan: 'free',
          credit_balance: 10,
          subscription_balance: 0,
          paygo_balance: 10,
        })
        .select()
        .single();

      if (wsErr) {
        addLog(`Workspace INSERT FAILED: ${wsErr.message} (code: ${wsErr.code})`);
        addLog(`This likely means an RLS policy is blocking the insert, or the table doesn't exist.`);
        setStatus('error');
        return;
      }

      addLog(`Workspace created: ${newWs.id}`);

      addLog('Creating workspace member row...');
      let memberErr = (await supabase
        .from('workspace_members')
        .insert({
          workspace_id: newWs.id,
          user_id: user.id,
          role: 'owner',
          email: user.email,
          display_name: displayName,
          invited_email: user.email,
          status: 'active',
          joined_at: new Date().toISOString(),
        })).error;

      if (memberErr && (memberErr.message.includes('status') || memberErr.message.includes('invited_email') || memberErr.message.includes('joined_at') || memberErr.message.includes('recursion'))) {
        addLog(`First insert failed (${memberErr.message}), retrying with minimal columns...`);
        memberErr = (await supabase
          .from('workspace_members')
          .insert({
            workspace_id: newWs.id,
            user_id: user.id,
            role: 'owner',
            email: user.email,
            display_name: displayName,
          })).error;
      }

      if (memberErr) {
        addLog(`workspace_members INSERT FAILED: ${memberErr.message} (code: ${memberErr.code})`);
        addLog('Cleaning up orphaned workspace...');
        await supabase.from('workspaces').delete().eq('id', newWs.id);
        setStatus('error');
        return;
      }

      addLog('Member row created! Adding welcome credits...');

      await supabase.from('credit_transactions').insert({
        workspace_id: newWs.id,
        user_id: user.id,
        amount: 10,
        balance_after: 10,
        type: 'bonus',
        description: 'Welcome to Binee! 10 free credits.',
      });

      const { error: profileErr } = await supabase.from('profiles').upsert({
        user_id: user.id,
        email: user.email,
        full_name: displayName,
      }, { onConflict: 'user_id' });
      if (profileErr) {
        await supabase.from('user_profiles').upsert({
          user_id: user.id,
          preferred_name: displayName,
        }, { onConflict: 'user_id' });
      }

      addLog('All done! Reloading...');
      setStatus('success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      addLog(`Unexpected error: ${err}`);
      setStatus('error');
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-navy-base items-center justify-center px-6">
      <div className="max-w-lg w-full text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-error/15 flex items-center justify-center mx-auto">
          <Hexagon className="w-6 h-6 text-error" />
        </div>
        <h2 className="text-lg font-medium text-text-primary">Workspace Setup Needed</h2>
        <p className="text-sm text-text-secondary">
          {wsError || 'Your workspace could not be created automatically. Click the button below to try again.'}
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={handleCreateWorkspace}
            disabled={status === 'loading' || status === 'success'}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {status === 'loading' && <Loader2 size={14} className="animate-spin" />}
            {status === 'success' ? 'Success! Reloading...' : status === 'loading' ? 'Setting up...' : 'Create Workspace'}
          </button>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:bg-surface transition-colors"
          >
            Sign Out
          </button>
        </div>

        {logs.length > 0 && (
          <div className="mt-4 text-left bg-navy-light border border-border rounded-lg p-3 max-h-64 overflow-y-auto">
            <p className="text-xs font-medium text-text-muted mb-2">Setup Log:</p>
            {logs.map((log, i) => (
              <p key={i} className={`text-xs font-mono leading-relaxed ${
                log.includes('FAILED') || log.includes('ERROR') || log.includes('WARNING')
                  ? 'text-error'
                  : log.includes('success') || log.includes('Success') || log.includes('created')
                    ? 'text-green-400'
                    : 'text-text-muted'
              }`}>
                {log}
              </p>
            ))}
          </div>
        )}

        <p className="text-xs text-text-muted">
          If this keeps failing, visit <a href="/api/auth/debug" target="_blank" className="font-mono text-accent hover:underline">/api/auth/debug</a> for full diagnostics.
        </p>
      </div>
    </div>
  );
}

/**
 * ChatPage — the conversation ID comes directly from a prop (set by the route
 * component from URL params). This is the industry-standard pattern:
 * URL → prop → hook. No context middleman for the conversation ID.
 */
export default function ChatPage({ conversationId: propConversationId }: { conversationId?: string } = {}) {
  const { user } = useAuth();
  const { credit_balance, workspace, loading: wsLoading, error: wsError } = useWorkspaceContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isNew = searchParams.get('new') === '1';
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null);
  const isOutOfCredits = Math.round(credit_balance) <= 0;

  const {
    conversations,
    createConversation,
    renameConversation,
  } = useSharedConversations();
  const setActiveConversation = useConversationUI((s) => s.setActiveConversation);

  // Conversation ID flows directly from URL prop — no context delay.
  // On /chat (no ID), this is null. On /chat/[id], it's the URL param.
  const effectiveConversationId = isNew ? null : (propConversationId ?? null);

  console.log('[binee:page] ChatPage render', {
    propConversationId,
    effectiveConversationId,
    isNew,
    wsLoading,
    hasUser: !!user,
    hasWorkspace: !!workspace,
  });

  const {
    messages,
    isLoading,
    isLoadingHistory,
    sendMessage,
    confirmAction,
    alwaysAllowAction,
  } = useChat(effectiveConversationId);

  console.log('[binee:page] ChatPage state', {
    messagesCount: messages.length,
    isLoading,
    isLoadingHistory,
    pendingFirstMessage: !!pendingFirstMessage,
  });

  // When ?new=1 is in URL, clear the active conversation so sidebar shows none selected
  useEffect(() => {
    if (isNew) {
      setActiveConversation(null);
      router.replace('/chat', { scroll: false });
    }
  }, [isNew, setActiveConversation, router]);

  const handleNewChat = useCallback(() => {
    setActiveConversation(null);
    router.push('/chat?new=1', { scroll: false });
  }, [setActiveConversation, router]);

  const handleSend = useCallback(
    async (content: string, fileContext?: string, imageAttachments?: Array<{ base64: string; media_type: string; name: string }>) => {
      if (isOutOfCredits) {
        setShowCreditsModal(true);
        return;
      }

      if (!effectiveConversationId) {
        // New conversation: show user message immediately, create in DB, then send
        setPendingFirstMessage(content.trim());
        const newId = await createConversation();
        sendMessage(content, newId, fileContext, imageAttachments);
        queueMicrotask(() => setPendingFirstMessage(null));
        // Navigate to the new conversation URL so the ID is in the URL
        if (newId && !newId.startsWith('conv-')) {
          router.push(`/chat/${newId}`, { scroll: false });
        }
      } else {
        sendMessage(content, undefined, fileContext, imageAttachments);
      }
    },
    [effectiveConversationId, createConversation, sendMessage, isOutOfCredits, router],
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

  const handleAlwaysAllowAction = useCallback(
    (id: string, toolName: string) => alwaysAllowAction(id, toolName),
    [alwaysAllowAction],
  );

  const handleRename = useCallback(
    (newTitle: string) => {
      if (effectiveConversationId) {
        renameConversation(effectiveConversationId, newTitle);
      }
    },
    [effectiveConversationId, renameConversation],
  );

  // Show error state when workspace setup failed
  if (!wsLoading && !workspace && user) {
    return <WorkspaceSetupError wsError={wsError} user={user} />;
  }

  const hasMessages = messages.length > 0 || pendingFirstMessage !== null || (effectiveConversationId !== null && isLoadingHistory);
  const firstName = user?.display_name?.split(' ')[0] || undefined;

  // Get title from conversations list
  const activeConversation = conversations.find((c) => c.id === effectiveConversationId);
  const conversationTitle = activeConversation?.title || 'New conversation';

  const emptyStateVariant: EmptyStateVariant = isOutOfCredits
    ? 'no-credits'
    : workspace && !workspace.clickup_connected && !workspace.clickup_team_id
      ? 'no-clickup'
      : 'no-conversations';

  const showWelcome =
    !hasMessages &&
    emptyStateVariant === 'no-conversations' &&
    (workspace?.clickup_connected || workspace?.clickup_team_id) &&
    conversations.length === 0;

  return (
    <div className="flex h-full overflow-hidden bg-navy-base">
      <div className="flex-1 min-w-0 flex flex-col">
        {hasMessages ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <ChatHeader title={conversationTitle} onRename={handleRename} />
            <MessageThread
              messages={
                pendingFirstMessage && messages.length === 0
                  ? [
                      {
                        id: 'pending-first-msg',
                        role: 'user' as const,
                        content: pendingFirstMessage,
                        timestamp: new Date(),
                      },
                    ]
                  : messages
              }
              isLoading={isLoading || pendingFirstMessage !== null}
              isLoadingHistory={isLoadingHistory}
              onConfirmAction={handleConfirmAction}
              onCancelAction={handleCancelAction}
              onAlwaysAllowAction={handleAlwaysAllowAction}
            />
            {isOutOfCredits ? (
              <UpgradePrompt />
            ) : (
              <ChatInput
                onSend={handleSend}
                disabled={isLoading || pendingFirstMessage !== null}
              />
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {showWelcome && workspace ? (
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <WelcomeMessage
                  firstName={firstName}
                  workspaceId={workspace.id}
                  onSuggestedPrompt={handleSuggestedPrompt}
                />
              </div>
            ) : (
              <EmptyState
                variant={emptyStateVariant}
                firstName={firstName}
                onSuggestedPrompt={handleSuggestedPrompt}
              />
            )}

            {(emptyStateVariant === 'no-conversations') && (
              <div className="shrink-0 w-full max-w-2xl mx-auto px-6 pb-6">
                <ChatInput
                  onSend={handleSend}
                  disabled={isLoading}
                  placeholder="Start a new chat..."
                />
              </div>
            )}
          </div>
        )}
      </div>

      <OutOfCreditsModal
        open={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
      />
    </div>
  );
}

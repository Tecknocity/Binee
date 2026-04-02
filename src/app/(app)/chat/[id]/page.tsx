'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSharedConversations } from '@/contexts/ConversationsContext';
import ChatPage from '@/components/chat/ChatPage';

export default function ChatConversationRoute() {
  const params = useParams();
  const conversationId = params.id as string;
  const { setActiveConversation } = useSharedConversations();

  // Sync URL → context (for sidebar highlight, etc.)
  useEffect(() => {
    if (conversationId) {
      setActiveConversation(conversationId);
    }
  }, [conversationId, setActiveConversation]);

  // Pass conversationId directly as prop so ChatPage has it on FIRST render,
  // before the context update above fires (which is deferred to after render).
  return <ChatPage conversationId={conversationId} />;
}

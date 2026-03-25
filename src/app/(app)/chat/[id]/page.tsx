'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSharedConversations } from '@/contexts/ConversationsContext';
import ChatPage from '@/components/chat/ChatPage';

export default function ChatConversationRoute() {
  const params = useParams();
  const conversationId = params.id as string;
  const { setActiveConversation } = useSharedConversations();

  useEffect(() => {
    if (conversationId) {
      setActiveConversation(conversationId);
    }
  }, [conversationId, setActiveConversation]);

  return <ChatPage />;
}

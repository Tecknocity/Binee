'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useConversations } from '@/hooks/useConversations';
import ChatPage from '@/components/chat/ChatPage';

export default function ChatConversationRoute() {
  const params = useParams();
  const conversationId = params.id as string;
  const { setActiveConversation } = useConversations();

  useEffect(() => {
    if (conversationId) {
      setActiveConversation(conversationId);
    }
  }, [conversationId, setActiveConversation]);

  return <ChatPage />;
}

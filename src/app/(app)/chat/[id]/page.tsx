'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useConversationUI } from '@/stores/conversationUI';
import ChatPage from '@/components/chat/ChatPage';

export default function ChatConversationRoute() {
  const params = useParams();
  const conversationId = params.id as string;
  const setActiveConversation = useConversationUI((s) => s.setActiveConversation);

  // Sync URL → context for sidebar highlight only.
  // ChatPage gets its conversationId directly from the prop below,
  // NOT from this context update (which fires after render).
  useEffect(() => {
    if (conversationId) {
      setActiveConversation(conversationId);
    }
  }, [conversationId, setActiveConversation]);

  // Pass conversationId directly as prop — available on FIRST render.
  return <ChatPage conversationId={conversationId} />;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  suggestedFollowups?: string[];
  feedback?: 'up' | 'down' | null;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

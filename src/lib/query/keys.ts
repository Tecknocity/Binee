/**
 * Centralized React Query key factory.
 *
 * Using a factory ensures consistent keys across components and makes
 * cache invalidation predictable. Call `queryClient.invalidateQueries({ queryKey: queryKeys.conversations(wsId, uid) })`
 * to invalidate a specific query, or `queryClient.invalidateQueries()` to invalidate everything.
 */
export const queryKeys = {
  // Conversation list for sidebar
  conversations: (workspaceId: string, userId: string) =>
    ['conversations', workspaceId, userId] as const,

  // Chat messages for a single conversation
  messages: (conversationId: string) =>
    ['messages', conversationId] as const,

  // User profile / preferences
  userProfile: (userId: string) =>
    ['userProfile', userId] as const,

  // Workspace members list
  workspaceMembers: (workspaceId: string) =>
    ['workspaceMembers', workspaceId] as const,
};

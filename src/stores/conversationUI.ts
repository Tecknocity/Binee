'use client';

import { create } from 'zustand';

/**
 * Zustand store for conversation UI state (sidebar highlight, etc.)
 *
 * Industry standard: high-frequency UI state (active selection, sidebar open/close)
 * lives in Zustand so only subscribing components re-render.
 * React Context re-renders ALL consumers on any state change.
 */

interface ConversationUIState {
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;
}

export const useConversationUI = create<ConversationUIState>((set) => ({
  activeConversationId: null,
  setActiveConversation: (id) => {
    console.log('[binee:conv] setActiveConversationId', id);
    set({ activeConversationId: id });
  },
}));

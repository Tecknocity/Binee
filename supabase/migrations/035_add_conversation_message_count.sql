-- Add message_count column to conversations table for summarization trigger
-- Phase 5: Conversation Summarization
alter table conversations
  add column if not exists message_count integer not null default 0;

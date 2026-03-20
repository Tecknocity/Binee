-- Migration: Add privacy preference columns to user_profiles
-- Stores allow_training and chat_history_enabled preferences

alter table user_profiles
  add column if not exists allow_training boolean not null default false,
  add column if not exists chat_history_enabled boolean not null default true;

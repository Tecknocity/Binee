-- Migration: Add onboarding_skipped_at to user_profiles
-- Tracks when a user skipped onboarding so we can show a reminder banner (B-084)

alter table user_profiles
  add column if not exists onboarding_skipped_at timestamptz default null;

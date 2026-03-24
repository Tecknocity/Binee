-- Migration: Add onboarding_completed flag to user_profiles
-- Tracks whether a user has completed the initial onboarding flow (B-080)

alter table user_profiles
  add column if not exists onboarding_completed boolean not null default false;

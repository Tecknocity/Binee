-- Migration: Strip user_metadata from JWT to prevent Vercel 494 errors
--
-- Problem: Supabase embeds raw_user_meta_data into the JWT, which is stored
-- in cookies by @supabase/ssr. Google OAuth dumps 15-20KB of profile data
-- into raw_user_meta_data on every sign-in. This makes cookies exceed
-- Vercel's 16KB header limit, causing 494 REQUEST_HEADER_TOO_LARGE errors.
--
-- Fix: A BEFORE trigger on auth.users that strips raw_user_meta_data to
-- only {display_name, avatar_url} before the row is written. Since the JWT
-- is generated FROM the row, the JWT (and cookies) will always be small.
--
-- The full profile data is already stored in the profiles and
-- workspace_members tables, so nothing is lost.

-- Step 1: Sync avatar_url from user_metadata to profiles table
-- (preserve Google avatar URLs before we strip them from metadata)
UPDATE profiles p
SET avatar_url = COALESCE(
  u.raw_user_meta_data->>'avatar_url',
  u.raw_user_meta_data->>'picture'
)
FROM auth.users u
WHERE p.user_id = u.id
  AND p.avatar_url IS NULL
  AND (u.raw_user_meta_data->>'avatar_url' IS NOT NULL
    OR u.raw_user_meta_data->>'picture' IS NOT NULL);

-- Also sync to workspace_members
UPDATE workspace_members wm
SET avatar_url = COALESCE(
  u.raw_user_meta_data->>'avatar_url',
  u.raw_user_meta_data->>'picture'
)
FROM auth.users u
WHERE wm.user_id = u.id
  AND wm.avatar_url IS NULL
  AND (u.raw_user_meta_data->>'avatar_url' IS NOT NULL
    OR u.raw_user_meta_data->>'picture' IS NOT NULL);

-- Step 2: Create the trigger function that strips metadata
CREATE OR REPLACE FUNCTION public.strip_user_metadata()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  _meta jsonb;
  _display_name text;
  _avatar_url text;
  _stripped jsonb;
BEGIN
  _meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  -- Extract display_name with fallback chain
  _display_name := COALESCE(
    _meta->>'display_name',
    _meta->>'full_name',
    _meta->>'name',
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'User'
  );

  -- Extract avatar_url (Google uses 'picture', Supabase uses 'avatar_url')
  _avatar_url := COALESCE(
    _meta->>'avatar_url',
    _meta->>'picture'
  );

  -- Build minimal metadata: only display_name + avatar_url
  _stripped := jsonb_build_object('display_name', _display_name);

  IF _avatar_url IS NOT NULL AND length(_avatar_url) < 500 THEN
    _stripped := _stripped || jsonb_build_object('avatar_url', _avatar_url);
  END IF;

  NEW.raw_user_meta_data := _stripped;
  RETURN NEW;
END;
$$;

-- Step 3: Create triggers on auth.users
-- BEFORE INSERT: strips metadata for new signups (email/password and OAuth)
CREATE TRIGGER strip_user_metadata_on_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.strip_user_metadata();

-- BEFORE UPDATE: strips metadata when it changes (OAuth re-sign-in,
-- updateUser calls, admin API updates)
CREATE TRIGGER strip_user_metadata_on_update
  BEFORE UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.strip_user_metadata();

-- Step 4: One-time cleanup of ALL existing users' metadata.
-- After this, every user's raw_user_meta_data will only contain
-- {display_name, avatar_url}. Their next token refresh (within 1 hour)
-- will produce a small JWT.
UPDATE auth.users
SET raw_user_meta_data = (
  SELECT jsonb_build_object(
    'display_name', COALESCE(
      raw_user_meta_data->>'display_name',
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      split_part(COALESCE(email, ''), '@', 1),
      'User'
    )
  ) || CASE
    WHEN COALESCE(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture') IS NOT NULL
      AND length(COALESCE(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture')) < 500
    THEN jsonb_build_object('avatar_url', COALESCE(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture'))
    ELSE '{}'::jsonb
  END
);

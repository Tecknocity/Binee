-- Migration: B-009 — Auto-create profile and workspace on first signup
-- Trigger function: runs after a new user is created in auth.users
-- Creates: profile row, workspace row, workspace_member row, credit_transaction row

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_workspace_id uuid;
  v_full_name text;
  v_slug text;
BEGIN
  -- Derive full_name with fallback to display_name then email username
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email, '@', 1)
  );

  -- Generate a unique slug from the name
  v_slug := lower(regexp_replace(v_full_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- Create profile
  INSERT INTO profiles (user_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Create workspace
  INSERT INTO workspaces (name, slug, owner_id, plan, credit_balance)
  VALUES (
    v_full_name || '''s Workspace',
    v_slug,
    NEW.id,
    'free',
    10
  )
  RETURNING id INTO v_workspace_id;

  -- Add user as owner member of their workspace
  INSERT INTO workspace_members (workspace_id, user_id, role, email, display_name, invited_email, status, joined_at)
  VALUES (v_workspace_id, NEW.id, 'owner', NEW.email, v_full_name, NEW.email, 'active', now());

  -- Record signup bonus credit transaction
  INSERT INTO credit_transactions (workspace_id, user_id, amount, balance_after, type, description)
  VALUES (v_workspace_id, NEW.id, 10, 10, 'bonus', 'Welcome to Binee! 10 free credits.');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

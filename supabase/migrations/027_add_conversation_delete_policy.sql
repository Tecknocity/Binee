-- Add DELETE policy for conversations so users can delete their own chats
-- Previously only SELECT, INSERT, and UPDATE policies existed, causing
-- client-side deletes to silently fail due to RLS.

drop policy if exists "Users can delete own conversations" on conversations;
create policy "Users can delete own conversations" on conversations
  for delete using (
    user_id = auth.uid() and
    workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

-- Messages cascade-delete via FK, but add an explicit DELETE policy
-- so users can also delete individual messages if needed.
drop policy if exists "Users can delete messages in own conversations" on messages;
create policy "Users can delete messages in own conversations" on messages
  for delete using (
    conversation_id in (select id from conversations where user_id = auth.uid())
  );

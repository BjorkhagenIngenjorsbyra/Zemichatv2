-- Migration #4/6 — server-side enforcement of the group-call participant cap.
--
-- A call's Agora channel name IS the chat id (see agora-token edge function:
-- `channelName = chatId`). Every active member of the chat can therefore mint a
-- join token and enter the channel. The client pre-checks this in
-- CallContext.initiateCall against MAX_GROUP_CALL_PARTICIPANTS (= 6, defined in
-- src/types/call.ts as the Agora free-tier cap), but that check is client-side
-- only and a modified client can skip it — joining an oversized channel and
-- blowing the Agora tier the cap exists to protect (Fable code review, #4/6).
--
-- This function is the authoritative server-side check. The agora-token edge
-- function calls it (as service_role) before issuing a join token, so the cap
-- holds regardless of client behaviour.
--
-- The cap value (6) is duplicated here intentionally: the TS constant drives the
-- UX pre-check, this SQL is the security gate. Keep the two in sync.

create or replace function public.chat_call_within_capacity(p_chat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct user_id) <= 6
  from public.chat_members
  where chat_id = p_chat_id
    and left_at is null;
$$;

comment on function public.chat_call_within_capacity(uuid) is
  'True when the chat has <= MAX_GROUP_CALL_PARTICIPANTS (6) active members, i.e. a call channel (= chat_id) cannot exceed the Agora free-tier cap. Authoritative server-side gate; called by the agora-token edge function. Mirror of the client-side MAX_GROUP_CALL_PARTICIPANTS check in src/types/call.ts.';

-- Only the edge function (service_role) needs to call this. Lock it down so it
-- is not exposed to clients. Supabase auto-grants EXECUTE on new public
-- functions to anon/authenticated via ALTER DEFAULT PRIVILEGES, so revoking
-- from PUBLIC is not enough — revoke from those roles explicitly. Otherwise any
-- logged-in user could probe arbitrary chats' member counts via this
-- SECURITY DEFINER function.
revoke all on function public.chat_call_within_capacity(uuid) from public;
revoke all on function public.chat_call_within_capacity(uuid) from anon;
revoke all on function public.chat_call_within_capacity(uuid) from authenticated;
grant execute on function public.chat_call_within_capacity(uuid) to service_role;

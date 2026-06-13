-- Atomic poll voting (Fable r3).
--
-- Single-choice vote switching was done client-side as a sequence of awaits:
-- unvote each existing vote, then vote, then reload — non-transactional and
-- unguarded. A failure mid-sequence could leave the user with zero votes or
-- duplicate votes, and two devices voting concurrently could both succeed,
-- violating the single-choice invariant (which was only enforced on the client).
--
-- cast_poll_vote does the clear-others-then-insert in one transaction. It is
-- SECURITY INVOKER, so the existing poll_votes RLS (membership + own-rows) still
-- applies — it only adds atomicity, not new privileges. A per-(poll,user)
-- advisory lock serializes concurrent votes from the same user across devices so
-- a single-choice poll can't end up with two rows.

create or replace function public.cast_poll_vote(p_poll_id uuid, p_option_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_allows_multiple boolean;
begin
  -- Serialize this user's votes on this poll (concurrent devices).
  perform pg_advisory_xact_lock(
    hashtextextended(p_poll_id::text || ':' || coalesce(auth.uid()::text, ''), 0)
  );

  select allows_multiple into v_allows_multiple from polls where id = p_poll_id;
  if v_allows_multiple is null then
    raise exception 'Poll not found' using errcode = 'P0002';
  end if;

  -- Single-choice: clear any existing votes by this user on this poll first.
  if not v_allows_multiple then
    delete from poll_votes where poll_id = p_poll_id and user_id = auth.uid();
  end if;

  -- Insert the new vote; idempotent against the existing unique constraint.
  insert into poll_votes (poll_id, option_id, user_id)
  values (p_poll_id, p_option_id, auth.uid())
  on conflict (poll_id, option_id, user_id) do nothing;
end;
$$;

comment on function public.cast_poll_vote(uuid, uuid) is
  'Atomically casts a poll vote: for single-choice polls clears the caller''s other votes first, then inserts. SECURITY INVOKER (RLS still applies); advisory-locked per (poll,user). Replaces the non-atomic client-side unvote+vote sequence (Fable r3).';

grant execute on function public.cast_poll_vote(uuid, uuid) to authenticated;

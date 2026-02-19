-- Index for efficient online-status / last-seen queries
CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON public.users (last_seen_at);

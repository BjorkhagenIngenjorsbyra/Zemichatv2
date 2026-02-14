-- Reset all existing teams to a fresh 10-day Pro trial starting today (2026-02-14).
-- This ensures every team gets the full trial period regardless of when they signed up.

UPDATE teams
SET plan = 'pro',
    trial_ends_at = now() + interval '10 days'
WHERE true;

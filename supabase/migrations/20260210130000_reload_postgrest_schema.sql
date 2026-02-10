-- Force PostgREST to reload its schema cache.
-- The create_super_invitation function exists but PostgREST's cached
-- schema doesn't see it, causing "Could not find the function" errors.
NOTIFY pgrst, 'reload schema';

-- Audit fix #18: chat-media bucket must be PRIVATE.
--
-- Storage RLS already protects SELECT/INSERT/UPDATE/DELETE for chat-media,
-- but a public bucket bypasses the SELECT policy entirely. URL leakage
-- (browser cache, support emails, screenshots, server logs) would expose
-- minor users' images, voice messages and locations indefinitely.
--
-- The application now uses createSignedUrl() with a 1h TTL, so the public
-- flag is no longer needed.

UPDATE storage.buckets
SET public = false
WHERE id = 'chat-media';

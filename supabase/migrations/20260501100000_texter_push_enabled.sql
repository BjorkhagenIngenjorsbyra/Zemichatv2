-- Add push_enabled toggle to texter_settings
-- Owner/Super can disable push notifications for individual Texters.
-- Default true so existing Texters keep current behaviour.

ALTER TABLE public.texter_settings
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.texter_settings.push_enabled IS
  'When false, send-push edge function skips FCM/APNs delivery for this Texter. In-app messages still arrive.';

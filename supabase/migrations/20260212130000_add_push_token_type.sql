-- ============================================================
-- Add token_type to push_tokens table
-- ============================================================
-- iOS devices register TWO tokens per user:
--   1. FCM token (for regular message notifications, proxied via Firebase)
--   2. VoIP token (for PushKit/CallKit incoming call notifications)
-- Android devices only use FCM tokens.
-- ============================================================

-- Create the enum type
CREATE TYPE push_token_type AS ENUM ('fcm', 'voip');

-- Add the column with a default of 'fcm' (all existing tokens are FCM)
ALTER TABLE push_tokens
  ADD COLUMN token_type push_token_type NOT NULL DEFAULT 'fcm';

-- Drop the old unique constraint and create a new one that includes token_type
-- This allows the same user to have both an FCM and VoIP token with the same value
-- (unlikely but possible), and more importantly allows two different tokens per user.
ALTER TABLE push_tokens
  DROP CONSTRAINT push_tokens_user_id_token_key;

ALTER TABLE push_tokens
  ADD CONSTRAINT push_tokens_user_id_token_token_type_key
    UNIQUE (user_id, token, token_type);

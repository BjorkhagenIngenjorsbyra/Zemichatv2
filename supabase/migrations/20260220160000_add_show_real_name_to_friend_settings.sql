-- Add toggle to control whether real name is shown below nickname
ALTER TABLE friend_settings
  ADD COLUMN IF NOT EXISTS show_real_name boolean NOT NULL DEFAULT false;

-- Add missing message_type enum values for sticker, gif, and poll
ALTER TYPE public.message_type ADD VALUE IF NOT EXISTS 'sticker';
ALTER TYPE public.message_type ADD VALUE IF NOT EXISTS 'gif';
ALTER TYPE public.message_type ADD VALUE IF NOT EXISTS 'poll';

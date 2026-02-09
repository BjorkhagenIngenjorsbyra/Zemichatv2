-- Seed: Holmgren family for App Store screenshots
-- Erik (Owner), Anna (Super), Ella (Texter, 14), Oscar (Texter, 11)

BEGIN;

-- Disable triggers for seeding
SET session_replication_role = 'replica';

-- Fixed UUIDs
-- Team
\set team_id   '''cc000000-0000-0000-0000-000000000001'''
-- Users
\set erik_id   '''cc000001-0000-0000-0000-000000000001'''
\set anna_id   '''cc000002-0000-0000-0000-000000000002'''
\set ella_id   '''cc000003-0000-0000-0000-000000000003'''
\set oscar_id  '''cc000004-0000-0000-0000-000000000004'''
-- Chats
\set chat_erik_ella   '''cc100001-0000-0000-0000-000000000001'''
\set chat_erik_oscar  '''cc100002-0000-0000-0000-000000000002'''
\set chat_ella_oscar  '''cc100003-0000-0000-0000-000000000003'''
\set chat_family      '''cc100004-0000-0000-0000-000000000004'''
\set chat_anna_ella   '''cc100005-0000-0000-0000-000000000005'''

-- ============================================================
-- 1. auth.users
-- ============================================================
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, role, aud,
  confirmation_token, recovery_token,
  email_change_token_new, email_change_token_current,
  email_change, phone_change, phone_change_token, reauthentication_token
) VALUES
-- Erik (Owner)
(
  :erik_id,
  '00000000-0000-0000-0000-000000000000',
  'erik@holmgren.se',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"display_name": "Erik", "role": "owner"}'::jsonb,
  now() - interval '30 days', now(),
  'authenticated', 'authenticated',
  '', '', '', '', '', '', '', ''
),
-- Anna (Super)
(
  :anna_id,
  '00000000-0000-0000-0000-000000000000',
  'anna@holmgren.se',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"display_name": "Anna", "role": "super"}'::jsonb,
  now() - interval '28 days', now(),
  'authenticated', 'authenticated',
  '', '', '', '', '', '', '', ''
),
-- Ella (Texter)
(
  :ella_id,
  '00000000-0000-0000-0000-000000000000',
  'ZEMI-ELL-001@texter.zemichat.local',
  extensions.crypt('ella2024', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"display_name": "Ella", "role": "texter", "zemi_number": "ZEMI-ELL-001"}'::jsonb,
  now() - interval '25 days', now(),
  'authenticated', 'authenticated',
  '', '', '', '', '', '', '', ''
),
-- Oscar (Texter)
(
  :oscar_id,
  '00000000-0000-0000-0000-000000000000',
  'ZEMI-OSC-001@texter.zemichat.local',
  extensions.crypt('oscar2024', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"display_name": "Oscar", "role": "texter", "zemi_number": "ZEMI-OSC-001"}'::jsonb,
  now() - interval '25 days', now(),
  'authenticated', 'authenticated',
  '', '', '', '', '', '', '', ''
);

-- ============================================================
-- 2. Team
-- ============================================================
INSERT INTO public.teams (id, name, owner_id, plan, trial_ends_at, created_at, updated_at)
VALUES (
  :team_id, 'Familjen Holmgren', :erik_id, 'pro',
  now() + interval '14 days',
  now() - interval '30 days', now()
);

-- ============================================================
-- 3. Users (public)
-- ============================================================
INSERT INTO public.users (id, team_id, role, zemi_number, display_name, avatar_url, last_seen_at, is_active, created_at, updated_at)
VALUES
  (:erik_id, :team_id, 'owner', 'ZEMI-100-001', 'Erik', NULL, now() - interval '2 minutes', true, now() - interval '30 days', now()),
  (:anna_id, :team_id, 'super', 'ZEMI-100-002', 'Anna', NULL, now() - interval '5 minutes', true, now() - interval '28 days', now()),
  (:ella_id, :team_id, 'texter', 'ZEMI-ELL-001', 'Ella', NULL, now() - interval '1 minute', true, now() - interval '25 days', now()),
  (:oscar_id, :team_id, 'texter', 'ZEMI-OSC-001', 'Oscar', NULL, now() - interval '10 minutes', true, now() - interval '25 days', now());

-- ============================================================
-- 4. Texter settings
-- ============================================================
INSERT INTO public.texter_settings (user_id, can_send_images, can_send_voice, can_send_video, can_send_documents, can_share_location, can_voice_call, can_video_call, can_screen_share)
VALUES
  (:ella_id, true, true, true, true, true, true, true, false),
  (:oscar_id, true, true, false, true, false, true, false, false);

-- ============================================================
-- 5. Chats
-- ============================================================
INSERT INTO public.chats (id, name, description, is_group, created_by, created_at, updated_at) VALUES
  (:chat_erik_ella,  NULL, NULL, false, :erik_id, now() - interval '20 days', now()),
  (:chat_erik_oscar, NULL, NULL, false, :erik_id, now() - interval '18 days', now()),
  (:chat_ella_oscar, NULL, NULL, false, :ella_id, now() - interval '15 days', now()),
  (:chat_family,     'Familjen Holmgren', 'Vår familjechatt!', true, :erik_id, now() - interval '20 days', now()),
  (:chat_anna_ella,  NULL, NULL, false, :anna_id, now() - interval '10 days', now());

-- ============================================================
-- 6. Chat members
-- ============================================================
INSERT INTO public.chat_members (chat_id, user_id, joined_at, unread_count, last_read_at) VALUES
  -- Erik <> Ella
  (:chat_erik_ella, :erik_id, now() - interval '20 days', 0, now()),
  (:chat_erik_ella, :ella_id, now() - interval '20 days', 0, now()),
  -- Erik <> Oscar
  (:chat_erik_oscar, :erik_id, now() - interval '18 days', 0, now()),
  (:chat_erik_oscar, :oscar_id, now() - interval '18 days', 1, now() - interval '30 minutes'),
  -- Ella <> Oscar
  (:chat_ella_oscar, :ella_id, now() - interval '15 days', 0, now()),
  (:chat_ella_oscar, :oscar_id, now() - interval '15 days', 0, now()),
  -- Family group
  (:chat_family, :erik_id, now() - interval '20 days', 0, now()),
  (:chat_family, :anna_id, now() - interval '20 days', 0, now()),
  (:chat_family, :ella_id, now() - interval '20 days', 2, now() - interval '1 hour'),
  (:chat_family, :oscar_id, now() - interval '20 days', 2, now() - interval '2 hours'),
  -- Anna <> Ella
  (:chat_anna_ella, :anna_id, now() - interval '10 days', 0, now()),
  (:chat_anna_ella, :ella_id, now() - interval '10 days', 1, now() - interval '45 minutes');

-- ============================================================
-- 7. Messages - Erik <> Ella (recent conversation)
-- ============================================================
-- Message IDs
\set m1  '''cc200001-0000-0000-0000-000000000001'''
\set m2  '''cc200002-0000-0000-0000-000000000002'''
\set m3  '''cc200003-0000-0000-0000-000000000003'''
\set m4  '''cc200004-0000-0000-0000-000000000004'''
\set m5  '''cc200005-0000-0000-0000-000000000005'''
\set m6  '''cc200006-0000-0000-0000-000000000006'''
\set m7  '''cc200007-0000-0000-0000-000000000007'''
\set m8  '''cc200008-0000-0000-0000-000000000008'''

INSERT INTO public.messages (id, chat_id, sender_id, type, content, reply_to_id, created_at) VALUES
  (:m1, :chat_erik_ella, :erik_id, 'text', 'Hej älskling! Hur var skolan idag? 😊', NULL, now() - interval '3 hours'),
  (:m2, :chat_erik_ella, :ella_id, 'text', 'Hej pappa! Jättebra! Vi fick läxa i matte men det var lätt 💪', NULL, now() - interval '2 hours 55 minutes'),
  (:m3, :chat_erik_ella, :erik_id, 'text', 'Vad bra! Stolt över dig! 🌟', :m2, now() - interval '2 hours 50 minutes'),
  (:m4, :chat_erik_ella, :ella_id, 'text', 'Tack! Kommer du och hämtar mig kl 15?', NULL, now() - interval '2 hours 45 minutes'),
  (:m5, :chat_erik_ella, :erik_id, 'text', 'Absolut! Jag står utanför som vanligt 🚗', NULL, now() - interval '2 hours 40 minutes'),
  (:m6, :chat_erik_ella, :ella_id, 'text', 'Toppen! Kan vi handla glass på vägen hem? 🍦', NULL, now() - interval '2 hours 35 minutes'),
  (:m7, :chat_erik_ella, :erik_id, 'text', 'Haha, varför inte! Du har förtjänat det 😄', :m6, now() - interval '2 hours 30 minutes'),
  (:m8, :chat_erik_ella, :ella_id, 'text', 'Yay! Bästa pappan! ❤️', NULL, now() - interval '2 hours 25 minutes');

-- ============================================================
-- 8. Messages - Erik <> Oscar
-- ============================================================
\set m10 '''cc200010-0000-0000-0000-000000000010'''
\set m11 '''cc200011-0000-0000-0000-000000000011'''
\set m12 '''cc200012-0000-0000-0000-000000000012'''
\set m13 '''cc200013-0000-0000-0000-000000000013'''
\set m14 '''cc200014-0000-0000-0000-000000000014'''

INSERT INTO public.messages (id, chat_id, sender_id, type, content, reply_to_id, created_at) VALUES
  (:m10, :chat_erik_oscar, :oscar_id, 'text', 'Pappa, kan jag sova över hos Lucas imorgon?', NULL, now() - interval '1 hour'),
  (:m11, :chat_erik_oscar, :erik_id, 'text', 'Hmm, det är skoldag på måndag. Vad säger Lucas mamma?', :m10, now() - interval '55 minutes'),
  (:m12, :chat_erik_oscar, :oscar_id, 'text', 'Hon sa att det var ok! Vi ska bara spela lite och titta på film 🎮', NULL, now() - interval '50 minutes'),
  (:m13, :chat_erik_oscar, :erik_id, 'text', 'Ok, men ni måste lägga er senast kl 22. Deal? 🤝', NULL, now() - interval '45 minutes'),
  (:m14, :chat_erik_oscar, :oscar_id, 'text', 'Deal! Tack pappa! 😁', :m13, now() - interval '40 minutes');

-- ============================================================
-- 9. Messages - Ella <> Oscar
-- ============================================================
\set m20 '''cc200020-0000-0000-0000-000000000020'''
\set m21 '''cc200021-0000-0000-0000-000000000021'''
\set m22 '''cc200022-0000-0000-0000-000000000022'''
\set m23 '''cc200023-0000-0000-0000-000000000023'''

INSERT INTO public.messages (id, chat_id, sender_id, type, content, reply_to_id, created_at) VALUES
  (:m20, :chat_ella_oscar, :ella_id, 'text', 'Oscar!! Kommer du på min kalas nästa lördag? 🎂', NULL, now() - interval '5 hours'),
  (:m21, :chat_ella_oscar, :oscar_id, 'text', 'Klart jag gör! Vad önskar du dig?', :m20, now() - interval '4 hours 50 minutes'),
  (:m22, :chat_ella_oscar, :ella_id, 'text', 'Jag önskar mig böcker och pennor 📚✏️', NULL, now() - interval '4 hours 45 minutes'),
  (:m23, :chat_ella_oscar, :oscar_id, 'text', 'Noterat! Ses på lördag! 🎉', NULL, now() - interval '4 hours 40 minutes');

-- ============================================================
-- 10. Messages - Family group chat
-- ============================================================
\set m30 '''cc200030-0000-0000-0000-000000000030'''
\set m31 '''cc200031-0000-0000-0000-000000000031'''
\set m32 '''cc200032-0000-0000-0000-000000000032'''
\set m33 '''cc200033-0000-0000-0000-000000000033'''
\set m34 '''cc200034-0000-0000-0000-000000000034'''
\set m35 '''cc200035-0000-0000-0000-000000000035'''
\set m36 '''cc200036-0000-0000-0000-000000000036'''
\set m37 '''cc200037-0000-0000-0000-000000000037'''

INSERT INTO public.messages (id, chat_id, sender_id, type, content, reply_to_id, created_at) VALUES
  (:m30, :chat_family, :anna_id, 'text', 'God morgon alla! ☀️ Frukost är klar!', NULL, now() - interval '6 hours'),
  (:m31, :chat_family, :ella_id, 'text', 'Kommer! 🏃‍♀️', NULL, now() - interval '5 hours 55 minutes'),
  (:m32, :chat_family, :oscar_id, 'text', 'Fem minuter till... 😴', NULL, now() - interval '5 hours 50 minutes'),
  (:m33, :chat_family, :erik_id, 'text', 'Haha, vakna nu Oscar! Pannkakor idag 🥞', :m32, now() - interval '5 hours 45 minutes'),
  (:m34, :chat_family, :oscar_id, 'text', 'PANNKAKOR?! Jag kommer!! 🏃‍♂️💨', NULL, now() - interval '5 hours 40 minutes'),
  (:m35, :chat_family, :anna_id, 'text', 'Glöm inte att vi ska till mormor efter skolan idag 👵', NULL, now() - interval '30 minutes'),
  (:m36, :chat_family, :ella_id, 'text', 'Åh vad kul! Jag saknar mormor 💕', :m35, now() - interval '25 minutes'),
  (:m37, :chat_family, :erik_id, 'text', 'Jag hämtar er kl 15, vi åker direkt dit 🚗', NULL, now() - interval '20 minutes');

-- ============================================================
-- 11. Messages - Anna <> Ella
-- ============================================================
\set m40 '''cc200040-0000-0000-0000-000000000040'''
\set m41 '''cc200041-0000-0000-0000-000000000041'''
\set m42 '''cc200042-0000-0000-0000-000000000042'''

INSERT INTO public.messages (id, chat_id, sender_id, type, content, reply_to_id, created_at) VALUES
  (:m40, :chat_anna_ella, :anna_id, 'text', 'Ella, kan du hjälpa mig baka till mormors besök? 🍰', NULL, now() - interval '1 hour 30 minutes'),
  (:m41, :chat_anna_ella, :ella_id, 'text', 'Ja!! Ska vi göra chokladbollarna som mormor gillar? 😍', :m40, now() - interval '1 hour 25 minutes'),
  (:m42, :chat_anna_ella, :anna_id, 'text', 'Perfekt! Vi börjar direkt när du kommer hem 👩‍🍳', NULL, now() - interval '1 hour 20 minutes');

-- ============================================================
-- 12. Reactions
-- ============================================================
INSERT INTO public.message_reactions (message_id, user_id, emoji, created_at) VALUES
  -- Erik <> Ella chat
  (:m2, :erik_id, '❤️', now() - interval '2 hours 54 minutes'),
  (:m2, :erik_id, '👍', now() - interval '2 hours 53 minutes'),
  (:m7, :ella_id, '😂', now() - interval '2 hours 29 minutes'),
  (:m8, :erik_id, '❤️', now() - interval '2 hours 24 minutes'),
  -- Erik <> Oscar chat
  (:m14, :erik_id, '👍', now() - interval '39 minutes'),
  -- Family group
  (:m30, :erik_id, '❤️', now() - interval '5 hours 44 minutes'),
  (:m30, :ella_id, '😊', now() - interval '5 hours 54 minutes'),
  (:m33, :oscar_id, '😂', now() - interval '5 hours 43 minutes'),
  (:m33, :anna_id, '😂', now() - interval '5 hours 42 minutes'),
  (:m34, :erik_id, '😂', now() - interval '5 hours 39 minutes'),
  (:m34, :anna_id, '❤️', now() - interval '5 hours 38 minutes'),
  (:m36, :anna_id, '❤️', now() - interval '24 minutes'),
  (:m36, :erik_id, '❤️', now() - interval '23 minutes'),
  -- Anna <> Ella
  (:m41, :anna_id, '❤️', now() - interval '1 hour 24 minutes');

-- Re-enable triggers
SET session_replication_role = 'origin';

COMMIT;

-- Wall visibility: self-toggle for Owner/Super, per-texter control for Owner
ALTER TABLE public.users ADD COLUMN wall_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.texter_settings ADD COLUMN can_access_wall boolean NOT NULL DEFAULT true;

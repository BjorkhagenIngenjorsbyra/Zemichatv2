-- Postgres kräver att ALTER TYPE ... ADD VALUE körs i sin egen migration
-- innan värdet kan refereras (t.ex. i WITH CHECK). Lägger värden här så
-- att 20260427160000_extend_reports_for_moderation.sql kan referera dem
-- direkt.

ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'resolved';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'dismissed';

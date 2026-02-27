-- ============================================================
-- Migration 005 – Priest Notes, Email Tracking, Reminder Flag
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add reminder_sent flag to bookings
--    Prevents duplicate 24h-before emails.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Booking notes – private, priest-only, one note per booking.
--    Uses a separate table so parishioners can never read these notes
--    via their existing bookings SELECT policy.
CREATE TABLE IF NOT EXISTS public.booking_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  priest_id   UUID        NOT NULL REFERENCES public.users(id),
  note        TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id)   -- one note per booking (priest edits in place)
);

ALTER TABLE public.booking_notes ENABLE ROW LEVEL SECURITY;

-- Only priests may read or write notes
CREATE POLICY "notes_priest_all"
  ON public.booking_notes
  FOR ALL
  TO authenticated
  USING  (public.get_current_user_role() = 'PRIEST')
  WITH CHECK (public.get_current_user_role() = 'PRIEST');

-- 3. Email log – records every send attempt for reliability auditing.
--    Written only by Edge Functions using the service role key,
--    so no authenticated RLS policy is needed.
CREATE TABLE IF NOT EXISTS public.email_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type      TEXT        NOT NULL,  -- 'parishioner_reminder' | 'priest_summary'
  recipient_email TEXT        NOT NULL,
  booking_id      UUID        REFERENCES public.bookings(id),
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  success         BOOLEAN     NOT NULL,
  error_message   TEXT
);

-- Service role (used by Edge Functions) bypasses RLS automatically.
-- Authenticated clients must not touch this table.
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT policies → only service_role can access it.

-- 4. Cron jobs (requires pg_cron extension — enabled on Supabase Pro).
--    Replace PROJECT_REF and SERVICE_ROLE_KEY with your actual values,
--    then uncomment and run in the SQL editor.
--
-- -- 24-hour parishioner reminder (runs every hour so it catches
-- -- bookings added at any time during the day before):
-- SELECT cron.schedule(
--   'parishioner-reminder',
--   '0 * * * *',
--   $$
--     SELECT net.http_post(
--       url     := 'https://PROJECT_REF.supabase.co/functions/v1/parishioner-reminder',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer SERVICE_ROLE_KEY',
--         'Content-Type',  'application/json'
--       ),
--       body    := '{}'::jsonb
--     );
--   $$
-- );
--
-- -- Priest daily summary at 06:00 CET = 05:00 UTC:
-- SELECT cron.schedule(
--   'priest-daily-summary',
--   '0 5 * * *',
--   $$
--     SELECT net.http_post(
--       url     := 'https://PROJECT_REF.supabase.co/functions/v1/priest-daily-summary',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer SERVICE_ROLE_KEY',
--         'Content-Type',  'application/json'
--       ),
--       body    := '{}'::jsonb
--     );
--   $$
-- );

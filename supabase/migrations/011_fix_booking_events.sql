-- ============================================================
-- Migration 011 – Fix booking event management
--
-- ROOT CAUSE: The original DB trigger `on_booking_confirmed`
-- was firing automatically and creating WRONG events:
--   • Title: 'Meeting: parishioner_name'  (old format)
--   • Time:  availability slot FULL window (e.g. 10:00–16:00)
--             instead of the specific booking window (e.g. 10:00–11:00)
--   • Type:  'MEETING' (old enum — maps to ACTIVITY)
--   • is_private: false
-- This caused "availability blocks" to appear in upcoming obligations
-- and old events to persist after cancellation.
--
-- This migration:
--   1. Drops the faulty trigger and function
--   2. Cleans up all bad events it created
--   3. Adds booking_id to events for reliable lookup
--   4. Creates email_log table if not present
-- ============================================================

-- ── 1. Drop faulty trigger and function ────────────────────
DROP TRIGGER IF EXISTS on_booking_confirmed ON public.bookings;
DROP FUNCTION IF EXISTS public.create_event_from_booking();

-- ── 2. Soft-delete all bad auto-generated events ──────────
-- These have title starting with 'Meeting:' (English, from the old trigger).
-- We use soft-delete to avoid FK cascade issues with the conversations table.
UPDATE public.events
SET is_deleted = true
WHERE title LIKE 'Meeting:%' AND is_deleted = false;

-- ── 3. Add booking_id to events for reliable lookup ────────
-- This allows us to find/delete/update the exact event that
-- belongs to a given booking without fragile title/time matching.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_booking_id
  ON public.events (booking_id)
  WHERE booking_id IS NOT NULL;

-- ── 4. Create email_log table if not present ───────────────
CREATE TABLE IF NOT EXISTS public.email_log (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_type      TEXT        NOT NULL,
  recipient_email TEXT        NOT NULL,
  booking_id      UUID        REFERENCES public.bookings(id) ON DELETE SET NULL,
  success         BOOLEAN     NOT NULL DEFAULT false,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow Edge Functions (service role) to insert into email_log
ALTER TABLE public.email_log DISABLE ROW LEVEL SECURITY;

-- ── 5. Grant delete on bookings for priests ────────────────
-- Ensure priests can also delete cancelled/old events
CREATE POLICY IF NOT EXISTS "Priests can delete events"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PRIEST')
  );

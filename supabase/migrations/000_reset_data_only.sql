-- ============================================================
-- SAFE DATA RESET — development / testing only
--
-- Deletes all transactional data while keeping:
--   • auth.users             (login accounts)
--   • public.users           (user profiles + roles)
--   • Schema / tables        (untouched)
--   • RLS policies           (untouched)
--   • Migrations             (untouched)
--   • Sequences              (reset to 1 where applicable)
--
-- DO NOT run on production without explicit intent.
-- ============================================================

BEGIN;

-- ── 1. Disable triggers temporarily so FK-order doesn't matter ──
SET session_replication_role = replica;

-- ── 2. Delete data (order doesn't matter with triggers disabled) ─

-- Booking notes (references bookings)
DELETE FROM public.booking_notes;

-- Email logs
DELETE FROM public.email_log;

-- Bookings (references availability_slots + users)
DELETE FROM public.bookings;

-- Availability slots
DELETE FROM public.availability_slots;

-- Conversations (references events)
DELETE FROM public.conversations;

-- Events (references users)
DELETE FROM public.events;

-- Cancellation notifications (may or may not exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'cancellation_notifications'
  ) THEN
    DELETE FROM public.cancellation_notifications;
  END IF;
END $$;

-- ── 3. Re-enable triggers ────────────────────────────────────
SET session_replication_role = DEFAULT;

-- ── 4. Reset sequences (all tables use UUID — no sequences to reset) ─
-- All primary keys in this schema use uuid_generate_v4() or gen_random_uuid().
-- There are no SERIAL / BIGSERIAL sequences to reset.
-- If you added any integer sequences manually, reset them here:
-- ALTER SEQUENCE <sequence_name> RESTART WITH 1;

COMMIT;

-- ── Verification ─────────────────────────────────────────────
SELECT 'booking_notes'             AS tbl, COUNT(*) AS rows FROM public.booking_notes
UNION ALL
SELECT 'email_log',                          COUNT(*) FROM public.email_log
UNION ALL
SELECT 'bookings',                           COUNT(*) FROM public.bookings
UNION ALL
SELECT 'availability_slots',                 COUNT(*) FROM public.availability_slots
UNION ALL
SELECT 'conversations',                      COUNT(*) FROM public.conversations
UNION ALL
SELECT 'events',                             COUNT(*) FROM public.events
UNION ALL
SELECT 'users (kept)',                       COUNT(*) FROM public.users;

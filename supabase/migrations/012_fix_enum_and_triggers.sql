-- ============================================================
-- Migration 012 – Definitive booking system repair
--
-- Fixes identified:
--   1. 'COMPLETED' missing from booking_status ENUM
--      (migration 010 wrongly used a CHECK constraint on an ENUM column)
--   2. bookings.updated_at column does not exist
--      (causes CancellationBanner to always return 0 rows)
--   3. No DB-level overlap prevention for bookings
--   4. Old 'Susret –' events have no booking_id — backfill + clean up
--
-- Run this ONCE in Supabase Dashboard → SQL Editor.
-- ============================================================

-- ── 1. Extend booking_status ENUM ─────────────────────────
-- ALTER TYPE … ADD VALUE is idempotent in PostgreSQL 11+ with IF NOT EXISTS
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'COMPLETED';

-- Drop the wrong CHECK constraint from migration 010 (harmless if already absent)
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;


-- ── 2. Add updated_at column to bookings ───────────────────
-- This column was referenced in the TypeScript interface but never created.
-- CancellationBanner uses it to filter recent cancellations.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Back-fill: set to created_at for all existing rows
UPDATE public.bookings
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Make the column NOT NULL now that all rows have a value
ALTER TABLE public.bookings
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- Trigger: auto-update whenever any column changes
CREATE OR REPLACE FUNCTION public.bookings_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.bookings_set_updated_at();


-- ── 3. DB-level overlap prevention ────────────────────────
-- Prevents double-booking at the slot+time level.
-- requested_start_time / requested_end_time are 'HH:MM' TEXT columns.
-- Lexicographic comparison works because the values are zero-padded.
CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  -- Skip check if no specific time was requested (old-style bookings)
  IF NEW.requested_start_time IS NULL OR NEW.requested_end_time IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip check when cancelling or completing (only block new PENDING/CONFIRMED)
  IF NEW.status NOT IN ('PENDING', 'CONFIRMED') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE availability_slot_id = NEW.availability_slot_id
      AND id        != NEW.id          -- exclude self on UPDATE
      AND status    IN ('PENDING', 'CONFIRMED')
      AND requested_start_time IS NOT NULL
      AND requested_end_time   IS NOT NULL
      -- Standard interval overlap: new_start < existing_end AND new_end > existing_start
      AND NEW.requested_start_time < requested_end_time
      AND NEW.requested_end_time   > requested_start_time
  ) THEN
    RAISE EXCEPTION 'booking_overlap'
      USING DETAIL = 'Odabrani termin se preklapa s postojećom rezervacijom. Molimo odaberite drugi termin.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_booking_overlap ON public.bookings;
CREATE TRIGGER trg_prevent_booking_overlap
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_booking_overlap();


-- ── 4. Backfill booking_id on existing 'Susret –' events ──
-- Croatian timezone offset: Europe/Zagreb = UTC+1 (winter) / UTC+2 (summer).
-- We use AT TIME ZONE 'Europe/Zagreb' to match the locally stored time.
UPDATE public.events e
SET booking_id = sub.booking_id
FROM (
  SELECT DISTINCT ON (e2.id)
    e2.id        AS event_id,
    b2.id        AS booking_id
  FROM public.events e2
  JOIN public.bookings b2
    ON b2.requested_start_time IS NOT NULL
    AND b2.status IN ('CONFIRMED', 'COMPLETED', 'CANCELLED')
  JOIN public.availability_slots s2
    ON s2.id = b2.availability_slot_id
  WHERE e2.title     LIKE 'Susret – %'
    AND e2.booking_id IS NULL
    AND e2.is_deleted  = false
    -- Match: event date (local) = slot date
    AND (e2.start_time AT TIME ZONE 'Europe/Zagreb')::date = s2.date
    -- Match: local HH:MM equals requested_start_time
    AND TO_CHAR(e2.start_time AT TIME ZONE 'Europe/Zagreb', 'HH24:MI') = b2.requested_start_time
  ORDER BY e2.id
) sub
WHERE e.id = sub.event_id;


-- ── 5. Soft-delete calendar events for CANCELLED bookings ──
-- Cleans up any event (old or new) still visible after a cancellation.
UPDATE public.events e
SET is_deleted = true
FROM public.bookings b
WHERE e.booking_id = b.id
  AND b.status      = 'CANCELLED'
  AND e.is_deleted  = false;


-- ── 6. Ensure the broad priest update policy has no WITH CHECK ─
-- bookings_update_priest from migration 003 inherits its USING clause
-- as the WITH CHECK, which allows updating to any valid status.
-- Nothing extra needed for COMPLETED once the ENUM is updated.

-- Verify that bookings_complete_priest from migration 010 is dropped
-- to avoid any accidental restriction conflict.
DROP POLICY IF EXISTS "bookings_complete_priest" ON public.bookings;

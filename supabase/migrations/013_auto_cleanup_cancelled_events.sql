-- ============================================================
-- Migration 013 – Server-side auto-cleanup of calendar events
--                 when a booking is cancelled
--
-- WHY THIS IS NEEDED:
--   The original schema (migration 001) contains a DB trigger
--   `on_booking_confirmed` that auto-creates events titled
--   "Meeting: parishioner_name" using the full availability window.
--   The frontend cleanup only targets "Susret – " events, so those
--   "Meeting:" events survive cancellation and stay visible in the
--   calendar forever.
--
--   This migration adds a server-side trigger that fires on EVERY
--   booking cancellation and soft-deletes ALL related event styles:
--     • By booking_id   (new events, added in migration 011)
--     • By "Susret – "  (app-created events)
--     • By "Meeting:"   (old DB-trigger events from migration 001)
--     • Any is_private event on the same day with ANY title
--       (belt-and-suspenders sweep)
--
--   It also runs a one-time cleanup of all existing data.
-- ============================================================


-- ── Step 1: Drop the old problematic trigger (idempotent) ──
DROP TRIGGER   IF EXISTS on_booking_confirmed        ON public.bookings;
DROP TRIGGER   IF EXISTS trg_prevent_booking_overlap ON public.bookings; -- will be re-added below
DROP FUNCTION  IF EXISTS public.create_event_from_booking();


-- ── Step 2: Create the auto-cleanup trigger ─────────────────
CREATE OR REPLACE FUNCTION public.cleanup_events_on_booking_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_date   DATE;
  v_day_start   TIMESTAMPTZ;
  v_day_end     TIMESTAMPTZ;
  v_first_name  TEXT;
  v_last_name   TEXT;
BEGIN
  -- Only act when status transitions TO 'CANCELLED'
  IF NEW.status::TEXT = 'CANCELLED' AND OLD.status::TEXT <> 'CANCELLED' THEN

    -- Get the date of the associated availability slot
    SELECT date INTO v_slot_date
    FROM public.availability_slots
    WHERE id = NEW.availability_slot_id;

    IF v_slot_date IS NOT NULL THEN
      -- Use a generous ±1 day window to handle any timezone offset stored in TIMESTAMPTZ
      v_day_start := (v_slot_date - INTERVAL '1 day')::TIMESTAMPTZ;
      v_day_end   := (v_slot_date + INTERVAL '2 days')::TIMESTAMPTZ;

      v_first_name := COALESCE(NEW.parishioner_first_name, '');
      v_last_name  := COALESCE(NEW.parishioner_last_name,  '');

      -- A. Soft-delete by booking_id (works after migration 011)
      UPDATE public.events
      SET is_deleted = true
      WHERE booking_id = NEW.id
        AND is_deleted = false;

      -- B. Soft-delete "Susret – FirstName LastName" style events (app-created)
      IF v_first_name <> '' OR v_last_name <> '' THEN
        UPDATE public.events
        SET is_deleted = true
        WHERE title ILIKE ('Susret – ' || v_first_name || ' ' || v_last_name || '%')
          AND is_deleted  = false
          AND start_time >= v_day_start
          AND start_time <  v_day_end;
      END IF;

      -- C. Soft-delete "Meeting: " style events (old trigger from migration 001)
      UPDATE public.events
      SET is_deleted = true
      WHERE title ILIKE 'Meeting:%'
        AND is_deleted  = false
        AND start_time >= v_day_start
        AND start_time <  v_day_end;

      -- D. Belt-and-suspenders: soft-delete ANY is_private event on the same
      --    day that has no booking_id (orphaned booking-related events)
      UPDATE public.events
      SET is_deleted = true
      WHERE is_private   = true
        AND booking_id   IS NULL
        AND is_deleted   = false
        AND start_time  >= v_day_start
        AND start_time  <  v_day_end
        AND (
          title ILIKE 'Susret%'
          OR title ILIKE 'Meeting%'
        );

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_on_cancel ON public.bookings;
CREATE TRIGGER trg_cleanup_on_cancel
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_events_on_booking_cancel();


-- ── Step 3: Overlap-prevention trigger (re-add, idempotent) ─
-- This was defined in migration 012. Re-creating it here ensures
-- it is present even if migration 012 was not run.

CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.requested_start_time IS NULL OR NEW.requested_end_time IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status::TEXT NOT IN ('PENDING', 'CONFIRMED') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE availability_slot_id = NEW.availability_slot_id
      AND id     != NEW.id
      AND status::TEXT IN ('PENDING', 'CONFIRMED')
      AND requested_start_time IS NOT NULL
      AND requested_end_time   IS NOT NULL
      AND NEW.requested_start_time < requested_end_time
      AND NEW.requested_end_time   > requested_start_time
  ) THEN
    RAISE EXCEPTION 'booking_overlap'
      USING DETAIL = 'Odabrani termin se preklapa s postojećom rezervacijom.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_booking_overlap ON public.bookings;
CREATE TRIGGER trg_prevent_booking_overlap
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_booking_overlap();


-- ── Step 4: One-time cleanup of all existing stale data ─────

-- 4a. Soft-delete all "Meeting:" events (from old trigger) that are still visible
UPDATE public.events
SET is_deleted = true
WHERE title ILIKE 'Meeting:%'
  AND is_deleted = false;

-- 4b. Soft-delete calendar events for all currently-CANCELLED bookings
--     (handles any event style: booking_id, Susret, Meeting, is_private orphans)
UPDATE public.events e
SET is_deleted = true
FROM public.bookings b
JOIN public.availability_slots s ON s.id = b.availability_slot_id
WHERE b.status::TEXT = 'CANCELLED'
  AND e.is_deleted   = false
  AND (
    e.booking_id = b.id
    OR (
      e.start_time >= (s.date::TIMESTAMPTZ - INTERVAL '1 day')
      AND e.start_time <  (s.date::TIMESTAMPTZ + INTERVAL '2 days')
      AND (
        e.title ILIKE ('Susret – ' ||
          COALESCE(b.parishioner_first_name,'') || ' ' ||
          COALESCE(b.parishioner_last_name,'') || '%')
        OR e.title ILIKE 'Meeting:%'
        OR (e.is_private = true AND e.booking_id IS NULL AND (e.title ILIKE 'Susret%' OR e.title ILIKE 'Meeting%'))
      )
    )
  );

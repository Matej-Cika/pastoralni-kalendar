-- ============================================================
-- Migration 015 – slot_date for bookings (preserve date when slot deleted)
--
-- When priest deletes an availability slot:
--   - PENDING/CONFIRMED bookings: cancel them, remove from calendar
--   - COMPLETED bookings: keep them for statistics (odrađene rezervacije)
--
-- We add slot_date so that when the slot is deleted, the booking
-- retains the meeting date for stats and display.
-- ============================================================

-- 1. Add slot_date (redundant copy of slot's date)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS slot_date DATE;

-- 2. Backfill from availability_slots
UPDATE public.bookings b
SET slot_date = s.date
FROM public.availability_slots s
WHERE b.availability_slot_id = s.id AND b.slot_date IS NULL;

-- 3. Trigger: set slot_date on insert from the slot
CREATE OR REPLACE FUNCTION public.bookings_set_slot_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.availability_slot_id IS NOT NULL AND NEW.slot_date IS NULL THEN
    SELECT date INTO NEW.slot_date
    FROM public.availability_slots
    WHERE id = NEW.availability_slot_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bookings_set_slot_date ON public.bookings;
CREATE TRIGGER trg_bookings_set_slot_date
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.bookings_set_slot_date();

-- 4. Allow availability_slot_id to be NULL (for when slot is deleted)
ALTER TABLE public.bookings
  ALTER COLUMN availability_slot_id DROP NOT NULL;

-- 5. Change FK to SET NULL on delete (so we can delete slot; bookings keep slot_date)
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_availability_slot_id_fkey;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_availability_slot_id_fkey
  FOREIGN KEY (availability_slot_id)
  REFERENCES public.availability_slots(id)
  ON DELETE SET NULL;

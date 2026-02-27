-- ============================================================
-- Migration 014 – Track status before cancellation
--
-- When a parishioner cancels:
--   PENDING cancel  → just remove request, no priest notification
--   CONFIRMED cancel → notify priest (email + landing page alert)
--
-- cancelled_from_status stores the status before the cancel.
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_from_status TEXT
    CHECK (cancelled_from_status IS NULL OR cancelled_from_status IN ('PENDING', 'CONFIRMED'));

-- Backfill: for existing CANCELLED rows, assume CONFIRMED if we can't tell
-- (keeps current behavior for old data)
UPDATE public.bookings
SET cancelled_from_status = 'CONFIRMED'
WHERE status = 'CANCELLED' AND cancelled_from_status IS NULL AND cancelled_by = 'PARISHIONER';

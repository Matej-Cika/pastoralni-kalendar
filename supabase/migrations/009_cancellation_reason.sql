-- ============================================================
-- Migration 009 – Add cancellation_reason to bookings
--
-- Stores the reason a priest provides when manually cancelling
-- a confirmed appointment, which is included in the email sent
-- to the parishioner.
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

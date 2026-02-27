-- ============================================================
-- Migration 008 – Drop obsolete unique constraint on bookings
--
-- Root cause: the old schema had UNIQUE(availability_slot_id, parishioner_id)
-- which allowed only one booking per parishioner per availability slot.
-- The new smart time-slot system (migration 004) replaced this logic with
-- requested_start_time / requested_end_time overlap detection, so the old
-- constraint is now incorrect and blocks all booking attempts with error 23505.
-- ============================================================

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_availability_slot_id_parishioner_id_key;

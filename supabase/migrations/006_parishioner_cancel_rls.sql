-- ============================================================
-- Migration 006 – Allow parishioners to cancel their own bookings
--
-- Root cause: migration 003 created bookings_update_priest which
-- is the ONLY UPDATE policy on bookings, blocking all parishioner
-- UPDATE calls (including cancellations) with a silent 0-row result.
--
-- Fix: add a permissive policy allowing parishioners to transition
-- their own bookings from PENDING or CONFIRMED → CANCELLED only.
-- The WITH CHECK ensures they cannot set any other status.
-- ============================================================

CREATE POLICY "bookings_cancel_parishioner"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    parishioner_id = auth.uid()
    AND status IN ('PENDING', 'CONFIRMED')
  )
  WITH CHECK (
    parishioner_id = auth.uid()
    AND status = 'CANCELLED'
  );

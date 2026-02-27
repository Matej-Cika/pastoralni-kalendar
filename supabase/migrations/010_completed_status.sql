-- ============================================================
-- Migration 010 – Add COMPLETED booking status
--
-- Allows priest to mark a confirmed meeting as completed,
-- moving it to history without it appearing as an upcoming
-- obligation.
-- ============================================================

-- Extend status check constraint
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'));

-- Allow priest to mark CONFIRMED bookings as COMPLETED
CREATE POLICY "bookings_complete_priest"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PRIEST')
    AND status = 'CONFIRMED'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'PRIEST')
    AND status = 'COMPLETED'
  );

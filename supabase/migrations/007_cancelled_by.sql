-- ============================================================
-- Migration 007 – Track who cancelled a booking
--
-- Adds a cancelled_by column so we can distinguish between:
--   PRIEST     – priest pressed "Odbij" (rejection)
--   PARISHIONER – parishioner pressed "Otkaži" (self-cancellation)
--
-- This enables:
--   • A dedicated in-app notification section for the priest
--   • An email alert to the priest when a parishioner cancels
--   • Correct badge counts in the navigation bar
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT
    CHECK (cancelled_by IN ('PRIEST', 'PARISHIONER'));

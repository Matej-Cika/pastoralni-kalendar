-- ============================================================
-- Migration 004 – Smart Booking System Upgrade
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add smart-booking columns to the bookings table
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS parishioner_first_name TEXT,
  ADD COLUMN IF NOT EXISTS parishioner_last_name  TEXT,
  ADD COLUMN IF NOT EXISTS parishioner_phone      TEXT,
  ADD COLUMN IF NOT EXISTS requested_start_time   TEXT,  -- 'HH:MM' within the availability window
  ADD COLUMN IF NOT EXISTS requested_end_time     TEXT,  -- 'HH:MM' within the availability window
  ADD COLUMN IF NOT EXISTS duration_minutes       INTEGER;

-- 2. Add a comment so future devs understand the time format
COMMENT ON COLUMN public.bookings.requested_start_time IS
  'Zero-padded HH:MM local time within the parent availability_slot.date';
COMMENT ON COLUMN public.bookings.requested_end_time IS
  'Zero-padded HH:MM local time within the parent availability_slot.date';

-- 3. Index to speed up overlap queries (slot + time range lookups)
CREATE INDEX IF NOT EXISTS idx_bookings_slot_time
  ON public.bookings (availability_slot_id, requested_start_time, requested_end_time)
  WHERE status IN ('PENDING', 'CONFIRMED');

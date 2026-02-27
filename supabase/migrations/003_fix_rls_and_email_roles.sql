-- ============================================================
-- Migration 003: Fix RLS policies and email-based role system
--
-- ROOT CAUSE: All policies on events/conversations/bookings/slots
-- used EXISTS(SELECT 1 FROM users WHERE role = 'PRIEST').
-- This nested subquery against an RLS-protected table creates
-- a query evaluation chain that can hang indefinitely under
-- certain session states or connection conditions.
--
-- FIX: Use a security-definer helper function to check the role
-- without triggering RLS recursion. Also implement email-based
-- role assignment and add missing INSERT policy on users.
-- ============================================================

-- ── Helper function ─────────────────────────────────────────
-- SECURITY DEFINER bypasses RLS on users table, so this
-- function returns the role directly without a nested RLS chain.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Allow all authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;


-- ── Update users policies ────────────────────────────────────
-- Add missing INSERT policy so auto-create from client works

DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;

CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ── Rewrite events policies ──────────────────────────────────
DROP POLICY IF EXISTS "Priests can view all events" ON public.events;
DROP POLICY IF EXISTS "Priests can create events" ON public.events;
DROP POLICY IF EXISTS "Priests can update events" ON public.events;
DROP POLICY IF EXISTS "events_select_priest" ON public.events;
DROP POLICY IF EXISTS "events_insert_priest" ON public.events;
DROP POLICY IF EXISTS "events_update_priest" ON public.events;
DROP POLICY IF EXISTS "events_delete_priest" ON public.events;

CREATE POLICY "events_select_priest"
  ON public.events FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() = 'PRIEST');

CREATE POLICY "events_insert_priest"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_current_user_role() = 'PRIEST'
    AND created_by = auth.uid()
  );

CREATE POLICY "events_update_priest"
  ON public.events FOR UPDATE
  TO authenticated
  USING (public.get_current_user_role() = 'PRIEST');

CREATE POLICY "events_delete_priest"
  ON public.events FOR DELETE
  TO authenticated
  USING (public.get_current_user_role() = 'PRIEST');


-- ── Rewrite conversations policies ──────────────────────────
DROP POLICY IF EXISTS "Priests can view all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Priests can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Priests can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select_priest" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_priest" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_priest" ON public.conversations;

CREATE POLICY "conversations_select_priest"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() = 'PRIEST');

CREATE POLICY "conversations_insert_priest"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (public.get_current_user_role() = 'PRIEST');

CREATE POLICY "conversations_update_priest"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (public.get_current_user_role() = 'PRIEST');


-- ── Rewrite availability_slots policies ─────────────────────
DROP POLICY IF EXISTS "Priests can manage availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "Parishioners can view active availability slots" ON public.availability_slots;
DROP POLICY IF EXISTS "slots_all_priest" ON public.availability_slots;
DROP POLICY IF EXISTS "slots_select_active" ON public.availability_slots;

CREATE POLICY "slots_all_priest"
  ON public.availability_slots FOR ALL
  TO authenticated
  USING (public.get_current_user_role() = 'PRIEST')
  WITH CHECK (public.get_current_user_role() = 'PRIEST');

CREATE POLICY "slots_select_active"
  ON public.availability_slots FOR SELECT
  TO authenticated
  USING (is_active = true);


-- ── Rewrite bookings policies ────────────────────────────────
DROP POLICY IF EXISTS "Parishioners can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Parishioners can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Priests can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_parishioner" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_priest" ON public.bookings;

CREATE POLICY "bookings_select"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    parishioner_id = auth.uid()
    OR public.get_current_user_role() = 'PRIEST'
  );

CREATE POLICY "bookings_insert_parishioner"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    parishioner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.availability_slots
      WHERE id = availability_slot_id AND is_active = true
    )
  );

CREATE POLICY "bookings_update_priest"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (public.get_current_user_role() = 'PRIEST');


-- ── Email-based role: update handle_new_user trigger ────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE
      WHEN NEW.email = 'ivanterze@gmail.com' THEN 'PRIEST'::user_role
      ELSE 'PARISHIONER'::user_role
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


-- ── Update ALL existing users to email-based roles ───────────
UPDATE public.users
SET role = CASE
  WHEN email = 'ivanterze@gmail.com' THEN 'PRIEST'::user_role
  ELSE 'PARISHIONER'::user_role
END;

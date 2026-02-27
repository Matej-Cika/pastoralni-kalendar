-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('PRIEST', 'PARISHIONER');
CREATE TYPE event_type_enum AS ENUM (
  'LITURGY_FEAST',
  'SOLEMNITY',
  'MASS',
  'DEVOTION',
  'MEETING',
  'CONVERSATION',
  'ADMINISTRATIVE',
  'PERSONAL'
);
CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'PARISHIONER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event types table (seed data)
CREATE TABLE event_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name event_type_enum NOT NULL UNIQUE,
  default_color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default event types with colors
INSERT INTO event_types (name, default_color) VALUES
  ('LITURGY_FEAST', '#FF6B6B'),
  ('SOLEMNITY', '#4ECDC4'),
  ('MASS', '#45B7D1'),
  ('DEVOTION', '#96CEB4'),
  ('MEETING', '#FFEAA7'),
  ('CONVERSATION', '#DDA0DD'),
  ('ADMINISTRATIVE', '#98D8C8'),
  ('PERSONAL', '#F7DC6F');

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  event_type event_type_enum NOT NULL,
  color TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Conversations table (specialized events)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  google_contact_id TEXT,
  phone_number TEXT,
  conversation_type TEXT,
  private_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Availability slots table
CREATE TABLE availability_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Bookings table
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  availability_slot_id UUID NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  parishioner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT,
  status booking_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(availability_slot_id, parishioner_id)
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Event types: readable by all authenticated users
CREATE POLICY "Authenticated users can view event types"
  ON event_types FOR SELECT
  TO authenticated
  USING (true);

-- Events policies
-- PRIEST: Full access
CREATE POLICY "Priests can view all events"
  ON events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'PRIEST'
    )
  );

CREATE POLICY "Priests can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'PRIEST'
    ) AND created_by = auth.uid()
  );

CREATE POLICY "Priests can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'PRIEST'
    )
  );

-- PARISHIONER: Can only see their own bookings (converted to events via RLS on bookings)
-- They cannot directly query events table

-- Conversations policies
CREATE POLICY "Priests can view all conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'PRIEST'
    )
  );

CREATE POLICY "Priests can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'PRIEST'
    )
  );

CREATE POLICY "Priests can update conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'PRIEST'
    )
  );

-- Availability slots policies
CREATE POLICY "Priests can manage availability slots"
  ON availability_slots FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'PRIEST'
    )
  );

-- Parishioners can view active availability slots
CREATE POLICY "Parishioners can view active availability slots"
  ON availability_slots FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Bookings policies
-- Parishioners can view their own bookings
CREATE POLICY "Parishioners can view their own bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    parishioner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'PRIEST'
    )
  );

-- Parishioners can create bookings
CREATE POLICY "Parishioners can create bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    parishioner_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM availability_slots
      WHERE availability_slots.id = availability_slot_id
      AND availability_slots.is_active = true
    )
  );

-- Priests can update booking status
CREATE POLICY "Priests can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'PRIEST'
    )
  );

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'PARISHIONER'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on auth signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to create calendar event when booking is confirmed
CREATE OR REPLACE FUNCTION create_event_from_booking()
RETURNS TRIGGER AS $$
DECLARE
  slot_record availability_slots%ROWTYPE;
  parishioner_record users%ROWTYPE;
  priest_record users%ROWTYPE;
  event_id UUID;
BEGIN
  -- Only create event when status changes to CONFIRMED
  IF NEW.status = 'CONFIRMED' AND (OLD.status IS NULL OR OLD.status != 'CONFIRMED') THEN
    -- Get availability slot details
    SELECT * INTO slot_record
    FROM availability_slots
    WHERE id = NEW.availability_slot_id;

    -- Get parishioner details
    SELECT * INTO parishioner_record
    FROM users
    WHERE id = NEW.parishioner_id;

    -- Get the priest who confirmed (current user from auth context)
    -- Since triggers run in the context of the user who made the change,
    -- we can get the priest ID from auth.uid()
    SELECT * INTO priest_record
    FROM users
    WHERE id = auth.uid() AND role = 'PRIEST'
    LIMIT 1;

    -- If no priest found, use the first priest (fallback)
    IF priest_record.id IS NULL THEN
      SELECT * INTO priest_record
      FROM users
      WHERE role = 'PRIEST'
      LIMIT 1;
    END IF;

    -- Only create event if we have a priest
    IF priest_record.id IS NOT NULL THEN
      -- Create event from booking
      INSERT INTO events (
        title,
        description,
        start_time,
        end_time,
        event_type,
        color,
        is_private,
        created_by,
        is_deleted
      ) VALUES (
        'Meeting: ' || COALESCE(parishioner_record.name, 'Parishioner'),
        COALESCE(NEW.purpose, 'Meeting with parishioner'),
        (slot_record.date || ' ' || slot_record.start_time)::TIMESTAMPTZ,
        (slot_record.date || ' ' || slot_record.end_time)::TIMESTAMPTZ,
        'MEETING',
        '#FFEAA7',
        false,
        priest_record.id,
        false
      )
      RETURNING id INTO event_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create event when booking is confirmed
CREATE TRIGGER on_booking_confirmed
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  WHEN (NEW.status = 'CONFIRMED')
  EXECUTE FUNCTION create_event_from_booking();

-- Indexes for performance
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_is_deleted ON events(is_deleted);
CREATE INDEX idx_conversations_event_id ON conversations(event_id);
CREATE INDEX idx_availability_slots_date ON availability_slots(date);
CREATE INDEX idx_availability_slots_is_active ON availability_slots(is_active);
CREATE INDEX idx_bookings_parishioner_id ON bookings(parishioner_id);
CREATE INDEX idx_bookings_availability_slot_id ON bookings(availability_slot_id);
CREATE INDEX idx_bookings_status ON bookings(status);

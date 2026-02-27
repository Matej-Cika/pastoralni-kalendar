-- Migration to update event types for pastoral calendar
-- IMPORTANT: Run this migration after the initial schema
-- This updates existing data and prepares for the new event type system

-- First, update any existing events to map old types to new ones
-- This preserves existing data by mapping to the closest new category
UPDATE events 
SET event_type = 'DEVOTION' 
WHERE event_type IN ('LITURGY_FEAST', 'SOLEMNITY') AND event_type != 'DEVOTION';

UPDATE events 
SET event_type = 'ACTIVITY' 
WHERE event_type IN ('MEETING', 'CONVERSATION', 'ADMINISTRATIVE', 'PERSONAL') 
  AND event_type NOT IN ('DEVOTION', 'ACTIVITY', 'SACRAMENT');

UPDATE events 
SET event_type = 'SACRAMENT' 
WHERE event_type = 'MASS';

-- Update event_types seed data to reflect new categories
DELETE FROM event_types WHERE name NOT IN ('DEVOTION', 'ACTIVITY', 'SACRAMENT');

-- Ensure the three main types exist with correct colors
INSERT INTO event_types (name, default_color) VALUES
  ('DEVOTION', '#6366f1'),
  ('ACTIVITY', '#10b981'),
  ('SACRAMENT', '#f59e0b')
ON CONFLICT (name) DO UPDATE SET default_color = EXCLUDED.default_color;

-- Note: If you need to change the enum type itself, you'll need to:
-- 1. Drop and recreate the enum (requires dropping dependent tables first)
-- 2. Or use a text column instead of enum
-- For now, the application will work with the existing enum as long as
-- only DEVOTION, ACTIVITY, and SACRAMENT values are used

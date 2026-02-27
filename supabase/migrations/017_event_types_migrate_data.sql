-- Migration 017: Migrate events and event_types to Croatian names
-- Run after 016 (enum values must be committed first)

UPDATE public.events SET event_type = 'POBOZNOST'::event_type_enum WHERE event_type::text = 'DEVOTION';
UPDATE public.events SET event_type = 'AKTIVNOST'::event_type_enum WHERE event_type::text = 'ACTIVITY';
UPDATE public.events SET event_type = 'SAKRAMENT'::event_type_enum WHERE event_type::text = 'SACRAMENT';

DELETE FROM public.event_types WHERE name IN ('DEVOTION', 'ACTIVITY', 'SACRAMENT');
INSERT INTO public.event_types (name, default_color) VALUES
  ('POBOZNOST', '#6366f1'),
  ('AKTIVNOST', '#10b981'),
  ('SAKRAMENT', '#f59e0b')
ON CONFLICT (name) DO UPDATE SET default_color = EXCLUDED.default_color;

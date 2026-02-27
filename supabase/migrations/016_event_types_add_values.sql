-- Migration 016: Add Croatian enum values (must commit before using them)
-- PostgreSQL requires new enum values to be committed before use in UPDATE/INSERT

ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'POBOZNOST';
ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'AKTIVNOST';
ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'SAKRAMENT';

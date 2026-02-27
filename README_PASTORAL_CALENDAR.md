# Pastoral Calendar - Table-Based Design

## Overview

This is a **table-based monthly pastoral calendar** designed specifically for Catholic priests to manage their daily pastoral duties.

## Key Features

### Layout
- **Rows**: Days of the month (date + weekday)
- **Columns**: Three pastoral categories
  1. **Devotions (Pobožnosti)** - Blue/Violet theme
  2. **Activities (Aktivnosti)** - Green theme  
  3. **Sacraments (Sakramenti)** - Gold theme

### Interaction
- Click any cell (day + category) to add/edit entries
- Multiple entries per cell (displayed as vertical list)
- Each entry includes:
  - Title (free text)
  - Start time (required)
  - End time (optional)
  - Notes (optional)

### Design Principles
- Clean, readable table layout
- Large, readable fonts
- Soft, calming colors
- No distracting animations
- Clear borders between days and columns

## Database Migration

If you're upgrading from the previous calendar system, run the migration:

```sql
-- Run this in Supabase SQL Editor
-- File: supabase/migrations/002_update_event_types.sql
```

This migration will:
- Map existing event types to the new categories
- Update event type colors
- Preserve all existing data

## Usage

1. Navigate to the Calendar page (Priest role required)
2. Use Previous/Next buttons to navigate months
3. Click any cell to add or edit entries for that day and category
4. Multiple entries can be added to the same cell
5. Entries are automatically saved and displayed in the cell

## Event Categories

### Devotions (Pobožnosti)
Examples: Eucharistic Adoration, Rosary, Novena, Prayer for Souls, St. Joseph Devotion

### Activities (Aktivnosti)  
Examples: House Blessings, Pastoral Conversations, Funerals, Meetings, Catechesis

### Sacraments (Sakramenti)
Examples: Mass, Baptism, Wedding, Confession, Anointing of the Sick

## Technical Notes

- All events use soft deletes (`is_deleted` flag)
- Row Level Security (RLS) ensures only priests can view/edit
- Events are filtered by month for performance
- Color coding is automatic based on category

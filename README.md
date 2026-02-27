# Terze Kalendar

A secure, lightweight web application for Catholic priests to manage liturgical events, pastoral duties, and meetings with parishioners.

## Features

- 📅 Calendar management with multiple views (month, week, day, agenda)
- 🔐 Google OAuth authentication
- 👥 Role-based access (Priest vs Parishioner)
- 📝 Event management with soft deletes
- 📞 Booking system for parishioners
- 🔒 Row Level Security (RLS) for data protection
- 💾 Automatic backups via Supabase

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Calendar**: FullCalendar
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

3. Run the database migration (see `supabase/migrations/001_initial_schema.sql`)

4. Start the development server:
```bash
npm run dev
```

## Database Setup

Run the SQL migration file in your Supabase SQL editor to create all necessary tables, enums, and RLS policies.

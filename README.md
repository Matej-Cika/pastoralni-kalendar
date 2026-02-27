# Terze Kalendar

A secure, lightweight web application for Catholic priests to manage liturgical events, pastoral duties, and meetings with parishioners.

## Features

- 📅 Calendar management with multiple views (month, week, day, agenda)
- 🔐 Prijava e-mail + lozinka
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
```

3. Run the database migration (see `supabase/migrations/001_initial_schema.sql`)

4. Start the development server:
```bash
npm run dev
```

## Database Setup

Run the SQL migration file in your Supabase SQL editor to create all necessary tables, enums, and RLS policies.

## Auth Configuration (Supabase)

Prijava koristi **e-mail + lozinka**. Nema potrebe za ručnom potvrdom – Edge Function `create-user` kreira korisnike s automatskom potvrdom.

1. **Obavezno deployati Edge Function**: `supabase functions deploy create-user` (vidi `supabase/EDGE_FUNCTIONS_DEPLOY.md`)
2. **URL Configuration** (za Zaboravljena lozinka): Dodajte `http://localhost:5173` i produkcijsku URL u Redirect URLs.

# Setup Instructions

## 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration file: `supabase/migrations/001_initial_schema.sql`
3. Go to **Authentication > Providers** and enable **Google** provider
4. Configure Google OAuth:
   - Create a project in [Google Cloud Console](https://console.cloud.google.com)
   - Enable Google+ API and People API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Add the Client ID and Client Secret to Supabase Google provider settings
   - Add scope: `https://www.googleapis.com/auth/contacts.readonly`
5. Copy your Supabase URL and anon key from **Settings > API**

## 2. Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. Install Dependencies

```bash
npm install
```

## 4. Run Development Server

```bash
npm run dev
```

## 5. First User Setup

1. Sign in with Google
2. Your user will be created automatically with `PARISHIONER` role
3. To make a user a PRIEST, run this SQL in Supabase SQL Editor:

```sql
UPDATE users SET role = 'PRIEST' WHERE email = 'priest@example.com';
```

Replace `priest@example.com` with the actual email address.

## 6. Google Contacts Integration

The app requests read-only access to Google Contacts during OAuth. If the token is not available in the session, the contacts feature will gracefully degrade - the app will still work, but you won't be able to select contacts from Google.

## Important Notes

- **No Hard Deletes**: All deletions are soft deletes (`is_deleted = true`)
- **Backups**: Supabase automatically backs up your database daily
- **RLS**: Row Level Security is enabled on all tables to ensure data safety
- **Role Management**: Only users with `PRIEST` role can manage events and availability slots

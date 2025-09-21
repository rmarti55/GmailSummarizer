# Supabase Setup Instructions

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up/login and click "New Project"
3. Choose organization and enter project details:
   - **Name**: Gmail Summarizer
   - **Database Password**: (generate a secure password)
   - **Region**: Choose closest to your location

## 2. Get API Keys

1. Go to Project Settings → API
2. Copy the following values to your `.env.local`:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

## 3. Set up Database Schema

1. Go to SQL Editor in your Supabase dashboard
2. Run the contents of `lib/supabase/database.sql`:

```sql
-- Create emails table to store Gmail messages and AI summaries
CREATE TABLE IF NOT EXISTS emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_id text NOT NULL UNIQUE,
  sender text NOT NULL,
  subject text NOT NULL,
  summary text,
  body_preview text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  read boolean DEFAULT false,
  CONSTRAINT emails_gmail_id_user_unique UNIQUE(gmail_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Create policy so users can only access their own emails
CREATE POLICY "Users can only access their own emails" ON emails
  FOR ALL USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS emails_user_id_created_at_idx ON emails(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS emails_gmail_id_idx ON emails(gmail_id);
```

## 4. Configure Google OAuth

1. In Supabase Dashboard → Authentication → Providers
2. Enable Google provider
3. Add your Google OAuth credentials:
   - **Client ID** and **Client Secret** from Google Cloud Console
   - **Redirect URL**: `https://your-project-ref.supabase.co/auth/v1/callback`

## 5. Set up Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable Gmail API
4. Create OAuth 2.0 credentials:
   - **Application type**: Web application
   - **Authorized redirect URIs**: 
     - `https://your-project-ref.supabase.co/auth/v1/callback`
     - `http://localhost:3000/api/auth/callback` (for development)
5. Copy Client ID and Secret to `.env.local`

## 6. Get Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up and create an API key
3. Add to `.env.local` as `GROQ_API_KEY`

## 7. Test the Setup

After updating `.env.local` with real values:
1. Restart your Next.js dev server: `npm run dev`
2. Visit `http://localhost:3000`
3. Click "Continue with Google" to test authentication
4. Check Supabase dashboard to see if user was created

Your `.env.local` should look like:
```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdef123456
GROQ_API_KEY=gsk_abcdef123456
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

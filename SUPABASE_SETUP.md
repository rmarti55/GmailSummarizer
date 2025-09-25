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

## 3. Set up Advanced Database Schema

The Gmail Summarizer uses a sophisticated database schema with AI classification fields and optimized indexing.

### Migration File
The schema is defined in: `supabase/migrations/20240101000000_create_emails_table.sql`

### Database Structure
**Primary Table: `emails`**
```sql
CREATE TABLE emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_id text NOT NULL,
  sender text NOT NULL,
  subject text NOT NULL,
  summary text,
  body_preview text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  read boolean DEFAULT false,
  
  -- AI Classification System
  email_type text,                    -- critical_action, quick_action, fyi_update, commercial, complex_content
  urgency_level text,                 -- high, medium, low
  action_required boolean DEFAULT false,
  classification_confidence decimal(3,2),  -- ML confidence score 0.00-1.00
  estimated_read_time integer,        -- Predicted read time in seconds
  
  CONSTRAINT emails_gmail_id_user_unique UNIQUE(gmail_id, user_id)
);
```

### Security & Performance Features
- **Row Level Security (RLS)** enabled with user isolation policies
- **Optimized Indexes** for fast classification queries
- **Unique Constraints** preventing duplicate Gmail messages per user

### Apply Schema

**For local development with Supabase CLI:**
```bash
supabase db reset
```

**For hosted Supabase:**
The migration will be automatically applied when you:
- Push to your repository (if using GitHub integration)
- Deploy your application
- Manually apply via Supabase dashboard SQL editor

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

## 7. Test the Advanced Setup

After updating `.env.local` with real values:

### Basic Authentication Test
1. Restart your Next.js dev server: `npm run dev`
2. Visit `http://localhost:3000`
3. Click "Continue with Google" to test authentication
4. Check Supabase dashboard to see if user was created

### Email Processing Test
1. After successful login, click "Refresh" to fetch Gmail emails
2. Verify emails appear with proper content parsing
3. Click "Summarize" on an email to test AI classification
4. Check the email gets classified with appropriate category and styling

### Database Verification
In Supabase dashboard → Table Editor → emails:
- Verify emails are stored with `gmail_id`, `sender`, `subject`, `body_preview`
- Check AI classification fields are populated: `email_type`, `urgency_level`, `classification_confidence`
- Confirm RLS is working (you only see your own emails)

### Complete `.env.local` Example
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdef123456

# AI Service (Groq with GPT-OSS-120B model)
GROQ_API_KEY=gsk_abcdef123456

# App Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Troubleshooting
- **No emails showing**: Check Gmail API permissions and OAuth scopes
- **Classification not working**: Verify Groq API key and model access
- **Database errors**: Confirm migration was applied and RLS policies are active

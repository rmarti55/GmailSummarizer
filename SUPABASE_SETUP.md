# Supabase Setup Instructions

Complete ops checklist for Gmail Summarizer. Follow every section — skipping migrations or mismatched OAuth credentials is the most common cause of broken production deploys.

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

`SUPABASE_SERVICE_ROLE_KEY` is **required**. The app stores Google refresh tokens in a server-only `gmail_credentials` table that only the service role can read/write. The anon key alone is not sufficient for durable Gmail connectivity.

## 3. Install Supabase CLI

Migrations are applied manually — they do **not** run on Vercel deploy or git push.

```bash
# macOS
brew install supabase/tap/supabase

# Or see https://supabase.com/docs/guides/cli
```

Link your project once:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Apply migrations:

```bash
npm run db:push
# equivalent to: supabase db push
```

**Vercel deploy does not update the database.** Deploying the app and updating Supabase are separate steps.

## 4. Database Migrations

All seven migration files must be applied to hosted Supabase. Files in git ≠ applied schema.

| Order | File | What it creates |
|-------|------|-----------------|
| 1 | `20240101000000_create_emails_table.sql` | `emails` table, RLS, indexes |
| 2 | `20240125000000_add_sender_statistics_function.sql` | `get_sender_statistics()` RPC (initial) |
| 3 | `20240724000000_create_email_sync_jobs.sql` | `email_sync_jobs` for resumable full sync |
| 4 | `20260724150000_create_gmail_credentials.sql` | `gmail_credentials` token vault |
| 5 | `20260724160000_add_history_id_to_sync_jobs.sql` | `history_id` on sync jobs |
| 6 | `20260728180000_add_sender_kind_fields.sql` | `from_email`, `from_domain`, `sender_kind`; updates RPC with `kind` |
| 7 | `20260728190000_add_sender_key.sql` | `sender_key` column, trigger, RPC groups by `sender_key` |

### Tables that matter now

**`emails`** — Cached Gmail messages
- Core: `gmail_id`, `sender`, `subject`, `body_preview`, `summary`, `created_at`, `user_id`, `read`
- Sender metadata: `from_email`, `from_domain`, `sender_kind` (`person` | `organization` | `unknown`), `sender_key`
- Legacy (unused by current summarize flow): `email_type`, `urgency_level`, `action_required`, `classification_confidence`, `estimated_read_time`

**`email_sync_jobs`** — Durable full-sync state (one row per user)
- `status`, `phase`, `current`, `total`, `message_ids`, `history_id`, `error`

**`gmail_credentials`** — Server-only Google token vault
- `access_token`, `refresh_token`, `expires_at`, `scopes`
- No RLS policies for browser clients; only service role access from server code

**`get_sender_statistics(user_id)`** — Returns sender, count, percentage, kind

### Apply schema

**Local development with Supabase CLI + Docker:**
```bash
supabase start   # if using local Supabase
supabase db reset
```

**Hosted Supabase (production):**
```bash
supabase link --project-ref YOUR_PROJECT_REF   # once
npm run db:push
```

Or paste SQL from each migration file into Supabase Dashboard → SQL Editor (in order).

### Verify migrations applied

In Supabase Dashboard → Table Editor, confirm these tables exist:
- `emails`
- `email_sync_jobs`
- `gmail_credentials`

In SQL Editor, test the RPC:
```sql
SELECT * FROM get_sender_statistics('YOUR_USER_UUID');
```

If People/Organizations filters show 0 while All shows hundreds, migrations 6–7 (`sender_kind`, `sender_key`) were likely not applied.

## 5. Configure Google OAuth in Supabase

1. Supabase Dashboard → Authentication → Providers → Google
2. Enable Google provider
3. Add Client ID and Client Secret from Google Cloud Console (see section 6)
4. Note the Supabase callback URL: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

### Supabase Auth URL configuration

Authentication → URL Configuration:
- **Site URL**: `http://localhost:3000` (dev) or your production URL
- **Redirect URLs** (allow list):
  - `http://localhost:3000/api/auth/callback`
  - `https://your-production-domain.com/api/auth/callback`

These are where Supabase redirects **after** Google auth — not the same as Google Console redirect URIs.

## 6. Set up Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable **Gmail API**
4. Create OAuth 2.0 credentials:
   - **Application type**: Web application
   - **Authorized redirect URIs** — add **only**:
     - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   - Do **not** put `http://localhost:3000/api/auth/callback` in Google Console — that URL belongs in Supabase's redirect allow list (section 5)
5. Copy Client ID and Secret to:
   - `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - Supabase Dashboard → Authentication → Providers → Google (same values)
   - Vercel environment variables (production — must match Supabase)

### OAuth app publishing status

If your Google OAuth app is in **Testing** mode, refresh tokens expire after ~7 days. Users will appear "disconnected" and need to sign in again. Move to **Production** and complete Google's verification for long-lived tokens.

### Gmail scope

The app requests full Gmail access: `https://mail.google.com/` (not readonly). Users must grant this scope at login. Missing scope surfaces as `gmail_scope_missing` on the login page.

## 7. Get OpenRouter API Key

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Create an API key
3. Add to `.env.local` as `OPENROUTER_API_KEY`

Optional:
- `SUMMARIZE_MODEL` — override default `google/gemini-2.5-flash-lite`
- `DISABLE_SUMMARIZATION=true` — block all summarize API calls

## 8. Complete `.env.local` Example

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google OAuth (same client as Supabase Google provider)
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdef123456

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-abcdef123456

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Vercel Cron — weekly free-tier Supabase keepalive (set in Vercel Production)
# openssl rand -hex 32
CRON_SECRET=your_cron_secret_here
```

Free Supabase projects hard-pause after 7 idle days. Production runs a weekly cron (`vercel.json` → `/api/cron/keepalive`) that does one REST read so that does not happen. Requires `CRON_SECRET` on Vercel.

## 9. Test the Setup

After updating `.env.local`:

### Authentication
1. Restart dev server: `npm run dev`
2. Visit `http://localhost:3000`
3. Click "Continue with Google"
4. Grant Gmail access when prompted
5. Check Supabase Dashboard → Authentication → Users for new user

### Email sync
1. After login, click **Refresh** for incremental sync (up to 100 new messages)
2. Or click **Get All My Emails** for full inbox sync with progress bar
3. Verify emails appear on the dashboard

### Summarization
1. Click **Summarize** on an email
2. Verify a one-sentence summary appears
3. Check Supabase → Table Editor → `emails` → `summary` column is populated

Do **not** expect `email_type` or `classification_confidence` to be populated — those columns are legacy and unused by the current summarize flow.

### Senders
1. Visit `/senders`
2. Verify sender list with counts
3. Test People / Organizations / All filters

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| People=0, Orgs=0, All=698 | `sender_kind` / `sender_key` migrations not applied | Run `npm run db:push` |
| Full sync stuck / no progress | `email_sync_jobs` table missing | Apply migration 3 |
| Disconnects after ~7 days | Google OAuth app in Testing mode | Publish OAuth app to Production |
| Disconnects immediately in prod | `GOOGLE_CLIENT_ID`/`SECRET` missing or wrong on Vercel | Match Supabase Google provider values |
| `gmail_scope_missing` at login | User denied Gmail scope | Re-login with `?consent=true` |
| `gmail_refresh_missing` | No offline refresh token stored | Re-login; ensure `gmail_credentials` table exists |
| Summarize returns 503 | Missing `OPENROUTER_API_KEY` | Add key to env |
| OAuth redirect error | Mismatch between Supabase allow list and app URL | Check Site URL and redirect URLs in Supabase Auth settings |

## 11. Production Deploy Checklist

1. Deploy app to Vercel with all env vars from section 8 (including `CRON_SECRET`)
2. Set `NEXT_PUBLIC_SITE_URL` to production domain
3. Add production callback URL to Supabase Auth redirect allow list
4. If any migration files changed in this release: `npm run db:push`
5. Confirm Vercel → Cron Jobs lists `/api/cron/keepalive` (Mondays)
6. Test login, sync, summarize, and senders filters on production

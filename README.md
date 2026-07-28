# Gmail Summarizer

A Next.js Gmail client that syncs your inbox, generates one-sentence AI summaries on demand, and surfaces sender analytics (People vs Organizations).

## Features

- **Gmail sync** — Incremental refresh (up to 100 new messages) and resumable full-inbox sync
- **On-demand summaries** — One-sentence summaries via OpenRouter (Gemini Flash Lite by default)
- **Sender analytics** — Top senders with People / Organizations / Unknown filters
- **Insights & Intelligence** — Keyword-heuristic analytics over stored email data
- **Bulk delete** — Trash emails in Gmail and remove from local cache
- **Secure auth** — Google OAuth via Supabase with server-side credential vault
- **Row-level security** — Users only access their own data in Supabase

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **Email**: Gmail API, Cheerio HTML parsing
- **AI**: OpenRouter (`google/gemini-2.5-flash-lite` default)
- **Sender classification**: Heuristic `person` / `organization` / `unknown` (not ML email-type classification)

## Prerequisites

1. **Google Cloud Console** account with Gmail API enabled
2. **Supabase** project (with Supabase CLI for migrations)
3. **OpenRouter** API key for summarization
4. **Node.js** 18+ and npm

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Google OAuth for Gmail API
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# OpenRouter (email summarization)
OPENROUTER_API_KEY=your_openrouter_api_key_here
# Optional override (default: google/gemini-2.5-flash-lite)
# SUMMARIZE_MODEL=google/gemini-2.5-flash-lite
# Set to true to block all summarization API calls
# DISABLE_SUMMARIZATION=true

# Site URL (for OAuth redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` is required — the app stores Google refresh tokens in a server-only `gmail_credentials` vault that only the service role can access.

## Quick Setup

1. **Clone and install:**
   ```bash
   git clone <your-repo-url>
   cd gmail-summarizer
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your keys
   ```

3. **Set up Supabase and OAuth:**
   - Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for database migrations, Google OAuth, and OpenRouter

4. **Start development:**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)**

## How It Works

1. **Authentication** — User signs in with Google via Supabase OAuth; tokens are persisted server-side in `gmail_credentials`
2. **Incremental sync** — Refresh fetches up to 100 inbox messages newer than the latest stored email
3. **Full sync** — "Get All My Emails" runs a resumable chunked sync with progress in `email_sync_jobs`
4. **Content parsing** — Cheerio extracts clean text from HTML, strips reply chains
5. **Summarization** — User clicks Summarize; OpenRouter returns a one-sentence summary saved to `emails.summary`
6. **Sender kind** — Heuristics classify senders as person, organization, or unknown for People/Orgs filters
7. **Analytics** — Insights and Intelligence pages use keyword heuristics over stored emails

Summaries are **not** generated automatically on load. Legacy DB columns (`email_type`, `urgency_level`, etc.) exist from an earlier design but are not populated by the current summarize flow.

## API Endpoints

### Gmail sync
- `GET /api/gmail` — Incremental sync (returns `{ syncedCount, prunedCount, message }`)
- `GET /api/gmail/count` — Email count and pagination (`?limit=N` returns emails)
- `GET /api/gmail/sync-status` — Full-sync job progress
- `POST /api/gmail/full-sync` — Run one chunk of full inbox sync
- `GET /api/gmail/connection-status` — Gmail token/scope health check

### Email management
- `DELETE /api/gmail/emails/[id]` — Trash in Gmail and delete from cache
- `POST /api/gmail/emails/batch-delete` — Batch trash (max 100 IDs)

### Summarization
- `POST /api/summarize` — Generate one-sentence summary (`{ emailId }` → `{ summary }`)

### Senders
- `GET /api/senders` — Sender stats with `kind` and People/Orgs counts
- `GET /api/senders/emails?sender=...` — Paginated emails for a sender
- `GET /api/senders/[sender]/emails` — Same, sender in path

### Analytics
- `GET /api/insights` — Peak hours, top senders, volume patterns
- `GET /api/intelligence?period=24h|week|month` — Action items and themes (keyword heuristics)

### Data management
- `POST /api/clear-summaries` — Clear all summaries for regeneration
- `POST /api/clear-emails` — Delete all cached emails

### Authentication
- `GET /api/auth/signin` — Start Google OAuth (supports `?consent=true`)
- `GET /api/auth/callback` — OAuth callback (Supabase-managed)
- `POST /api/auth/signout` — Sign out (`{ success: true }`)

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for request/response details.

## Database Schema

Seven migrations under `supabase/migrations/`:

| Table / object | Purpose |
|----------------|---------|
| `emails` | Cached Gmail messages, summaries, sender metadata (`sender_key`, `sender_kind`) |
| `email_sync_jobs` | Durable full-sync progress (resumable across serverless invocations) |
| `gmail_credentials` | Server-only Google token vault (service role access only) |
| `get_sender_statistics()` | RPC for sender counts grouped by `sender_key` with `kind` |

Apply all migrations manually — see [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Development

```bash
npm run dev          # Dev server (Turbopack)
npm run dev:clean    # Clear .next and restart
npm run dev:restart  # Kill port 3000, clear .next, restart
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run test         # Unit tests
npm run db:push      # Apply Supabase migrations (requires Supabase CLI)
```

## Security

- **Row Level Security (RLS)** — Users only access their own emails and sync jobs
- **Credential vault** — Google tokens in `gmail_credentials`; no RLS policies for browser clients
- **Google OAuth 2.0** — Full Gmail scope (`https://mail.google.com/`) with offline refresh
- **Environment variables** — All secrets externalized; never commit `.env.local`

## Deployment

The app deploys to Vercel. **Deploying the app does not update the Supabase database.**

### Deploy checklist

| Step | Action |
|------|--------|
| 1 | Deploy app to Vercel (connect GitHub repo, set env vars, deploy) |
| 2 | If `supabase/migrations/` changed: run `npm run db:push` from your terminal |

### Vercel setup

1. Connect your GitHub repository to Vercel
2. Add all environment variables from `.env.example` in the Vercel dashboard
3. Ensure `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` match the Google OAuth client configured in Supabase Auth
4. Set `NEXT_PUBLIC_SITE_URL` to your production URL
5. Deploy
6. If this release added or changed files in `supabase/migrations/`, run `npm run db:push` against your hosted Supabase project

## Documentation

- **[Setup Guide](SUPABASE_SETUP.md)** — Supabase, OAuth, migrations, and troubleshooting
- **[API Documentation](API_DOCUMENTATION.md)** — Endpoint reference with request/response shapes
- **[Architecture Guide](ARCHITECTURE.md)** — Sync pipeline, schema, and UI structure

## License

This project is private and proprietary.

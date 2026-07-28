# Architecture Documentation

## System Overview

Gmail Summarizer is a Next.js email client that syncs Gmail to Supabase, generates one-sentence AI summaries on demand, and provides sender analytics with People/Organizations filtering.

## Core Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   Supabase DB    │    │   Gmail API     │
│  (Frontend/API)  │◄──►│  (PostgreSQL)    │    │   (Google)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  OpenRouter AI  │    │   Row Level      │    │   OAuth 2.0     │
│ (Gemini 2.5 FL) │    │   Security       │    │  Authentication │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Email Processing Pipeline

### 1. Authentication & Authorization

- **Google OAuth 2.0**: Full Gmail scope (`https://mail.google.com/`) with offline refresh
- **Supabase Auth**: Session management via SSR cookies
- **Credential vault**: Google tokens persisted server-side in `gmail_credentials` (service role only)
- **Row Level Security**: Database-level user isolation on `emails` and `email_sync_jobs`

Sign-in flow: `GET /api/auth/signin` → Google consent → Supabase callback → `GET /api/auth/callback` persists tokens and verifies Gmail access.

### 2. Email Fetching & Parsing

```
Gmail API → Raw Email Data → Content Parser → Clean Text → Database
```

**Content processing (`src/lib/email-service.ts`, Cheerio):**
- Handles malformed HTML and Microsoft Office markup
- Strips reply chains and signatures
- Normalizes whitespace and extracts preview text
- Graceful fallback for parsing failures

### 3. Gmail Sync Pipeline

#### Sync Service (`src/lib/gmail-sync.ts`)

Shared ingest logic for incremental refresh and full inbox sync:

- **Incremental sync** (`GET /api/gmail`): fetches up to 100 inbox messages newer than the latest stored email, processes via `EmailService`, upserts to Supabase
- **Full sync** (`POST /api/gmail/full-sync`): resumable, chunked sync safe for Vercel serverless (`maxDuration: 60`)
  - **Listing phase**: paginate Gmail inbox once, accumulate message IDs in `email_sync_jobs`
  - **Processing phase**: fetch and upsert emails in batches of 50 with bounded concurrency
  - **Cleanup phase**: remove stale DB rows no longer in Gmail inbox
- **Progress** (`GET /api/gmail/sync-status`): reads durable job state from `email_sync_jobs` table (not in-memory)

Dashboard **Refresh** triggers incremental sync; **Get All My Emails** runs full sync with progress polling.

### 4. AI Summarization

#### Summarize API (`src/app/api/summarize/route.ts`)

On-demand summarization via OpenRouter (`google/gemini-2.5-flash-lite` by default):

```
Load email from DB → OpenRouter one-sentence summary → Save to emails.summary
```

Dashboard does not auto-summarize on load. `AdaptiveSummary` formats stored summary text — it does not apply category themes or color coding. Set `DISABLE_SUMMARIZATION=true` to hard-pause. Override model with `SUMMARIZE_MODEL`.

### 5. Sender Classification

Heuristic classification in `src/lib/sender-classifier.ts`:

- Classifies senders as `person`, `organization`, or `unknown`
- Persisted to `emails.sender_kind` with backfill on read
- Powers People/Organizations filters on `/senders`
- Read-time fallback in `sender-utils.ts` when DB kind is missing

This is separate from legacy `email_type` columns (unused by current summarize flow).

### 6. Analytics

Insights (`/api/insights`) and Intelligence (`/api/intelligence`) use keyword heuristics over stored email data — not ML classification or OpenRouter.

## Database Schema Design

### `emails`

```sql
CREATE TABLE emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_id text NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  sender text NOT NULL,
  subject text NOT NULL,
  body_preview text,
  summary text,
  created_at timestamptz DEFAULT now(),
  read boolean DEFAULT false,

  -- Sender metadata (active)
  from_email text,
  from_domain text,
  sender_kind text CHECK (sender_kind IN ('person', 'organization', 'unknown')),
  sender_key text,

  -- Legacy classification (unused by summarize)
  email_type text,
  urgency_level text,
  action_required boolean DEFAULT false,
  classification_confidence decimal(3,2),
  estimated_read_time integer,

  CONSTRAINT emails_gmail_id_user_unique UNIQUE(gmail_id, user_id)
);
```

### `email_sync_jobs`

One row per user. Stores resumable full-sync state across serverless invocations.

Key columns: `status`, `phase`, `current`, `total`, `message_ids` (jsonb), `processed_offset`, `history_id`, `error`.

### `gmail_credentials`

Server-only token vault. No RLS policies for browser clients — only service role access from server code.

Key columns: `access_token`, `refresh_token`, `expires_at`, `scopes`.

### `get_sender_statistics(user_id)`

RPC returning `sender`, `count`, `percentage`, `kind` per sender bucket.

### Security Policies

```sql
CREATE POLICY "Users can only access their own emails" ON emails
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own sync jobs" ON email_sync_jobs
  FOR ALL USING (auth.uid() = user_id);
```

## User Interface Architecture

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — email list, Refresh, Get All My Emails, Summarize |
| `/senders` | Sender stats with People/Organizations/All filters |
| `/insights` | Volume patterns, peak hours, top senders |
| `/intelligence` | Action items and themes (keyword heuristics) |
| `/login` | Google OAuth sign-in |

### Component Hierarchy

```
Dashboard (page.tsx)
├── Header (navigation, sync controls)
├── Email List
│   ├── Loading / Empty states
│   └── Email rows
│       ├── Metadata (sender, subject, date)
│       ├── Body preview
│       └── AdaptiveSummary (formats stored summary text)
└── Bulk selection + delete

Senders (senders/page.tsx)
├── Kind filter tabs (All / People / Organizations)
└── Sender list with counts

Insights / Intelligence
└── Analytics views fed by /api/insights and /api/intelligence
```

### AdaptiveSummary (`src/components/AdaptiveSummary.tsx`)

Formats stored summary text for display. Does not apply category-based themes, icons, or priority badges — those were removed with the old classification system.

## API Design Patterns

### RESTful Endpoints

- `GET /api/gmail` — incremental sync (returns counts, not email list)
- `GET /api/gmail/count?limit=N` — load emails for UI
- `POST /api/gmail/full-sync` — chunked full sync
- `POST /api/summarize` — on-demand AI summary
- `DELETE /api/gmail/emails/[id]` — trash + cache delete
- `POST /api/gmail/emails/batch-delete` — batch trash

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for full reference.

### Authentication Middleware

Routes using `withAuthHandler` get guaranteed authenticated user:

```typescript
export const GET = withAuthHandler(async ({ user, supabase }) => {
  // user is authenticated
})
```

Other routes call `supabase.auth.getUser()` directly and return `401` if missing.

### Error Handling

```typescript
{
  error: string,
  details?: object | string
}
```

## Security Architecture

1. **Application layer** — API route auth checks, same-origin cookies
2. **Database layer** — RLS on user-scoped tables; no browser access to `gmail_credentials`
3. **Authentication layer** — Google OAuth with offline refresh, token vault, automatic refresh via `google-auth.ts`
4. **Network layer** — HTTPS, secure cookies, env var protection

## Scalability Considerations

- **Database indexing** — User-scoped queries with timestamp ordering
- **Resumable sync** — Full sync survives serverless timeouts via `email_sync_jobs`
- **Batch processing** — Email fetch/upsert in bounded concurrency batches
- **API rate limits** — Respects Gmail and OpenRouter quotas

## Development & Deployment

### Local setup

1. Copy `.env.example` to `.env.local`
2. Apply migrations: `npm run db:push` (requires Supabase CLI)
3. Run `npm run dev`

Migrations are **not** applied automatically — run `db:push` manually after schema changes.

### Production (Vercel)

1. Deploy Next.js app to Vercel with all env vars
2. If `supabase/migrations/` changed: run `npm run db:push` separately
3. API routes run as Node.js serverless functions (not Edge)
4. Full sync route uses `maxDuration: 60`

Vercel deploys the app only. Supabase is a separate hosted database.

# API Documentation

## Overview

The Gmail Summarizer API provides endpoints for Gmail sync, on-demand summarization, sender analytics, and session management.

All endpoints except `/api/auth/callback` and `/api/auth/signin` require an authenticated Supabase session. The browser sends session cookies automatically — no `Authorization: Bearer` header is needed for same-origin fetch calls from the app.

## Authentication

Session-based auth via Supabase SSR cookies. Server routes call `supabase.auth.getUser()` and return `401` if unauthenticated.

**Sign-in flow:**
1. Browser navigates to `GET /api/auth/signin`
2. User completes Google OAuth via Supabase
3. Supabase redirects to `GET /api/auth/callback?code=...`
4. Callback exchanges code, persists Google tokens, redirects to dashboard

---

## Gmail Sync

### `GET /api/gmail`

Runs incremental inbox sync — fetches up to 100 messages newer than the latest stored email.

**Response:**
```json
{
  "syncedCount": 12,
  "prunedCount": 0,
  "message": "Synced 12 new emails"
}
```

**Errors:** `401` unauthorized, `400`/`502` Gmail token issues, `500` sync failure

---

### `GET /api/gmail/count`

Returns email count, or paginated emails when `limit > 0`.

**Query parameters:**
| Param | Default | Description |
|-------|---------|-------------|
| `limit` | `0` | If > 0, returns emails instead of count |
| `offset` | `0` | Pagination offset (with `limit`) |
| `sender` | — | Filter by sender display name |
| `sort` | `date` | `date` or `sender` |
| `order` | `desc` (date) / `asc` (sender) | Sort direction |

**Count response:**
```json
{
  "totalEmails": 698,
  "lastSyncTime": "2026-07-28T12:00:00.000Z"
}
```

**Pagination response (`limit > 0`):**
```json
{
  "emails": [ /* email rows */ ]
}
```

---

### `GET /api/gmail/sync-status`

Returns durable full-sync job progress from `email_sync_jobs`.

**Response:**
```json
{
  "current": 450,
  "total": 698,
  "isRunning": true,
  "status": "running",
  "phase": "processing",
  "error": null,
  "updatedAt": "2026-07-28T12:00:00.000Z"
}
```

When `status` is `completed`, the endpoint returns the completed progress once then resets the job to idle.

**Idle response:**
```json
{
  "current": 0,
  "total": 0,
  "isRunning": false,
  "status": "idle"
}
```

---

### `POST /api/gmail/full-sync`

Runs one chunk of resumable full inbox sync (safe for Vercel serverless, `maxDuration: 60`).

**Response (in progress):**
```json
{
  "message": "Full sync in progress",
  "status": "running",
  "progress": {
    "current": 200,
    "total": 698,
    "isRunning": true,
    "status": "running",
    "phase": "processing"
  }
}
```

**Response (complete):**
```json
{
  "message": "Full sync complete",
  "status": "completed",
  "progress": { "current": 698, "total": 698, "isRunning": false, "status": "completed" }
}
```

Poll `GET /api/gmail/sync-status` between chunks, or call `POST` repeatedly until `status: "completed"`.

---

### `GET /api/gmail/connection-status`

Checks Gmail token health without triggering a sync.

**Connected:**
```json
{
  "connected": true,
  "lastChecked": "2026-07-28T12:00:00.000Z"
}
```

**Disconnected:**
```json
{
  "connected": false,
  "error": "Gmail permission missing — reconnect to grant access",
  "code": "missing_scopes",
  "lastChecked": "2026-07-28T12:00:00.000Z",
  "needsReauth": true
}
```

Possible `code` values: `missing_scopes`, token refresh failures, etc.

---

## Email Management

### `DELETE /api/gmail/emails/[id]`

Trashes the email in Gmail and removes it from the local cache.

**Response:**
```json
{ "success": true }
```

**Errors:** `404` email not found, `502` Gmail trash failed

---

### `POST /api/gmail/emails/batch-delete`

Trashes up to 100 emails in Gmail and removes from cache.

**Request body:**
```json
{
  "ids": ["uuid-1", "uuid-2"]
}
```

**Response:**
```json
{
  "success": true,
  "deletedIds": ["uuid-1", "uuid-2"],
  "failedIds": []
}
```

**Errors:** `400` empty or >100 IDs, `404` no matching emails, `502` Gmail batch trash failed

---

## Summarization

### `POST /api/summarize`

Generates a one-sentence summary via OpenRouter and saves it to `emails.summary`.

**Request body:**
```json
{
  "emailId": "uuid"
}
```

**Response:**
```json
{
  "summary": "John asks you to review the Q3 budget proposal by Friday."
}
```

Returns cached summary immediately if one already exists. Does **not** populate `email_type` or other legacy classification columns.

**Errors:**
- `400` — missing `emailId`
- `404` — email not found
- `503` — `OPENROUTER_API_KEY` not configured or `DISABLE_SUMMARIZATION=true`
- `500` — OpenRouter or database error

**Environment:**
- `OPENROUTER_API_KEY` — required
- `SUMMARIZE_MODEL` — optional, default `google/gemini-2.5-flash-lite`
- `DISABLE_SUMMARIZATION=true` — blocks all summarize calls

---

## Senders

### `GET /api/senders`

Returns sender statistics with People/Organizations counts.

**Response:**
```json
{
  "senders": [
    {
      "sender": "alice@company.com",
      "count": 42,
      "percentage": 6.0,
      "kind": "person"
    }
  ],
  "counts": {
    "all": 698,
    "person": 120,
    "organization": 450,
    "unknown": 128
  }
}
```

Triggers read-time backfill of `sender_kind` and `sender_key` when needed. Falls back to client-side aggregation if the RPC is unavailable.

---

### `GET /api/senders/emails`

Paginated emails for a sender (query param variant).

**Query parameters:**
| Param | Default | Description |
|-------|---------|-------------|
| `sender` | required | Sender display name or email |
| `page` | `1` | Page number |
| `limit` | `100` | Page size (clamped to 10, 20, 50, or 100) |

**Response:**
```json
{
  "emails": [ /* email rows */ ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 42,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### `GET /api/senders/[sender]/emails`

Same as above with sender URL-encoded in the path.

**Query parameters:** `page` (default `1`), `limit` (default `100`)

---

## Analytics

### `GET /api/insights`

Analyzes the last 500 emails for volume patterns.

**Response:**
```json
{
  "analytics": {
    "peakHour": "9:00 AM",
    "peakDay": "Tuesday",
    "totalAnalyzed": 500,
    "avgPerDay": 17,
    "topSenders": [
      { "sender": "news@company.com", "count": 45, "percentage": 9.0 }
    ],
    "emailTypes": {
      "unclassified": 500
    }
  }
}
```

`emailTypes` reads legacy `email_type` column — typically all `unclassified` since summarize does not populate it.

---

### `GET /api/intelligence`

Keyword-heuristic analysis for a time period.

**Query parameters:**
| Param | Default | Options |
|-------|---------|---------|
| `period` | `24h` | `24h`, `week`, `month` |

**Response:**
```json
{
  "period": "24h",
  "totalEmails": 15,
  "actionItems": [
    {
      "id": "uuid",
      "subject": "Budget review needed",
      "sender": "boss@company.com",
      "urgency": "high",
      "timeAgo": "2h ago",
      "reason": "Has deadline mentioned"
    }
  ],
  "themes": [
    { "name": "Work & Projects", "count": 8, "percentage": 53, "description": "Project updates and work tasks" }
  ],
  "patterns": [
    { "type": "volume", "description": "Significantly higher email volume than usual", "change": "increase", "percentage": 45 }
  ],
  "comparison": {
    "volumeChange": 45,
    "newSenders": 2
  }
}
```

---

## Data Management

### `POST /api/clear-summaries`

Clears all `summary` fields for the authenticated user. Emails are preserved.

**Response:**
```json
{ "message": "All summaries cleared successfully" }
```

---

### `POST /api/clear-emails`

Deletes all cached emails for the authenticated user.

**Response:**
```json
{
  "success": true,
  "message": "All emails cleared successfully"
}
```

---

## Authentication

### `GET /api/auth/signin`

Starts Google OAuth flow. Redirects to Google consent screen.

**Query parameters:**
| Param | Description |
|-------|-------------|
| `redirectTo` | Path to redirect after login (default `/`) |
| `consent=true` | Force consent screen (useful for re-granting Gmail scope) |

Requests scopes: `openid email profile https://mail.google.com/` with offline access.

---

### `GET /api/auth/callback`

Handles Supabase OAuth callback. Not called directly — Supabase redirects here after Google auth.

On success: persists Google tokens to `gmail_credentials`, verifies Gmail scope, redirects to app.

On failure redirects to `/login?error=...`:
- `gmail_scope_missing` — Gmail scope not granted
- `gmail_refresh_missing` — no durable refresh token
- `gmail_connection_failed` — token save or verification failed
- `oauth_failed` — general OAuth failure

---

### `POST /api/auth/signout`

Signs out the current user.

**Response:**
```json
{ "success": true }
```

---

## Error Format

All endpoints return consistent error shapes:

```json
{
  "error": "Human-readable message",
  "details": "optional additional context"
}
```

**Common status codes:**
| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request (missing params) |
| `401` | Unauthorized (no session) |
| `404` | Resource not found |
| `502` | Gmail API failure |
| `503` | Summarization disabled or misconfigured |
| `500` | Internal server error |

---

## Usage Examples

### Sync and load emails

```javascript
// Incremental sync
await fetch('/api/gmail');

// Load paginated emails for dashboard
const res = await fetch('/api/gmail/count?limit=50&offset=0&sort=date&order=desc');
const { emails } = await res.json();
```

### Full sync with progress

```javascript
// Start/resume full sync (call until status is completed)
let done = false;
while (!done) {
  const res = await fetch('/api/gmail/full-sync', { method: 'POST' });
  const data = await res.json();
  done = data.status === 'completed';
  console.log(data.progress);
}

// Or poll sync-status separately
const status = await fetch('/api/gmail/sync-status');
const progress = await status.json();
```

### Summarize an email

```javascript
const res = await fetch('/api/summarize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ emailId: 'uuid-here' }),
});
const { summary } = await res.json();
```

### Check Gmail connection

```javascript
const res = await fetch('/api/gmail/connection-status');
const { connected, needsReauth, code } = await res.json();
if (!connected && needsReauth) {
  window.location.href = '/api/auth/signin?consent=true';
}
```

---

## Rate Limits

- **Gmail API**: Google's per-user quota (250 quota units per 100 seconds)
- **OpenRouter**: Per your OpenRouter plan
- **Supabase**: Handled by Supabase scaling

## Security

- **Row Level Security**: All email and sync job queries scoped to authenticated user
- **Credential vault**: Google tokens stored in `gmail_credentials`; browser clients cannot access
- **Session cookies**: HttpOnly cookies managed by Supabase SSR
- **Same-origin**: API routes intended for same-origin browser requests with session cookies

-- Server-only vault for Google OAuth tokens (never exposed to the browser JWT/session)
CREATE TABLE IF NOT EXISTS gmail_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp with time zone NOT NULL,
  scopes text,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE gmail_credentials ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: browser clients cannot read or write tokens.
-- Only the service_role key (bypasses RLS) may access this table from server code.

CREATE INDEX IF NOT EXISTS gmail_credentials_expires_at_idx ON gmail_credentials(expires_at);

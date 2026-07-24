-- Durable sync job state for Gmail full sync (serverless-safe, resumable)
CREATE TABLE IF NOT EXISTS email_sync_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'completed', 'failed')),
  mode text NOT NULL DEFAULT 'full' CHECK (mode IN ('full', 'incremental')),
  current integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  phase text NOT NULL DEFAULT 'idle' CHECK (phase IN ('idle', 'listing', 'processing', 'cleanup', 'done')),
  list_page_token text,
  message_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  processed_offset integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE email_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own sync jobs" ON email_sync_jobs
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS email_sync_jobs_user_id_idx ON email_sync_jobs(user_id);

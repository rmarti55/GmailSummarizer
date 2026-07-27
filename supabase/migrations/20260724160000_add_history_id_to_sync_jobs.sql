-- Store Gmail historyId for efficient incremental sync via History API
ALTER TABLE email_sync_jobs
  ADD COLUMN IF NOT EXISTS history_id text;

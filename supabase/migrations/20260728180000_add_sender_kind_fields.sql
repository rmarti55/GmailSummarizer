-- Persist From address metadata and sender classification for People vs Organizations
ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS from_email text,
  ADD COLUMN IF NOT EXISTS from_domain text,
  ADD COLUMN IF NOT EXISTS sender_kind text CHECK (sender_kind IN ('person', 'organization', 'unknown'));

CREATE INDEX IF NOT EXISTS emails_user_id_sender_kind_idx ON emails(user_id, sender_kind);
CREATE INDEX IF NOT EXISTS emails_user_id_sender_idx ON emails(user_id, sender);

-- Return sender statistics with majority-vote kind per sender bucket
CREATE OR REPLACE FUNCTION get_sender_statistics(user_id uuid)
RETURNS TABLE (
  sender text,
  count bigint,
  percentage numeric(5,1),
  kind text
)
LANGUAGE plpgsql
AS $$
DECLARE
  total_emails bigint;
BEGIN
  SELECT COUNT(*) INTO total_emails
  FROM emails
  WHERE emails.user_id = get_sender_statistics.user_id;

  RETURN QUERY
  SELECT
    e.sender,
    COUNT(*) AS count,
    CASE
      WHEN total_emails > 0 THEN ROUND((COUNT(*) * 100.0 / total_emails), 1)
      ELSE 0
    END AS percentage,
    (
      SELECT ranked.kind
      FROM (
        SELECT
          COALESCE(inner_e.sender_kind, 'unknown') AS kind,
          COUNT(*) AS kind_count
        FROM emails inner_e
        WHERE inner_e.user_id = get_sender_statistics.user_id
          AND inner_e.sender = e.sender
        GROUP BY COALESCE(inner_e.sender_kind, 'unknown')
        ORDER BY kind_count DESC, kind ASC
        LIMIT 1
      ) ranked
    ) AS kind
  FROM emails e
  WHERE e.user_id = get_sender_statistics.user_id
  GROUP BY e.sender
  ORDER BY COUNT(*) DESC;
END;
$$;

-- Canonical sender identity for stats + expand queries (mirrors JS normalizeSenderKey)
CREATE OR REPLACE FUNCTION normalize_sender_key(raw_sender text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text := btrim(coalesce(raw_sender, ''));
  parsed text;
BEGIN
  IF length(t) >= 2 AND left(t, 1) = '"' AND right(t, 1) = '"' THEN
    parsed := replace(substring(t FROM 2 FOR length(t) - 2), '""', '"');
  ELSE
    parsed := t;
  END IF;

  parsed := replace(replace(parsed, U&'\2018', ''''), U&'\2019', '''');
  parsed := btrim(parsed);

  IF parsed = '' THEN
    RETURN 'Unknown sender';
  END IF;

  RETURN parsed;
END;
$$;

ALTER TABLE emails
  ADD COLUMN IF NOT EXISTS sender_key text;

UPDATE emails
SET sender_key = normalize_sender_key(sender)
WHERE sender_key IS NULL;

ALTER TABLE emails
  ALTER COLUMN sender_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS emails_user_id_sender_key_idx ON emails(user_id, sender_key);

CREATE OR REPLACE FUNCTION emails_set_sender_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sender_key := normalize_sender_key(NEW.sender);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS emails_set_sender_key_trigger ON emails;

CREATE TRIGGER emails_set_sender_key_trigger
  BEFORE INSERT OR UPDATE OF sender ON emails
  FOR EACH ROW
  EXECUTE FUNCTION emails_set_sender_key();

DROP FUNCTION IF EXISTS get_sender_statistics(uuid);

CREATE FUNCTION get_sender_statistics(user_id uuid)
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
    e.sender_key AS sender,
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
          AND inner_e.sender_key = e.sender_key
        GROUP BY COALESCE(inner_e.sender_kind, 'unknown')
        ORDER BY kind_count DESC, kind ASC
        LIMIT 1
      ) ranked
    ) AS kind
  FROM emails e
  WHERE e.user_id = get_sender_statistics.user_id
  GROUP BY e.sender_key
  ORDER BY COUNT(*) DESC;
END;
$$;

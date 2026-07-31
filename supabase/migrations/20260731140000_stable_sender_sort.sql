-- Stable tiebreaker for equal-count senders in stats ranking
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
  ORDER BY COUNT(*) DESC, e.sender_key ASC;
END;
$$;

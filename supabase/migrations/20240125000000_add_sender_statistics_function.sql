-- Create function to get sender statistics efficiently
CREATE OR REPLACE FUNCTION get_sender_statistics(user_id uuid)
RETURNS TABLE (
  sender text,
  count bigint,
  percentage numeric(5,1)
) 
LANGUAGE plpgsql
AS $$
DECLARE
  total_emails bigint;
BEGIN
  -- Get total email count for percentage calculation
  SELECT COUNT(*) INTO total_emails 
  FROM emails 
  WHERE emails.user_id = get_sender_statistics.user_id;
  
  -- Return sender statistics
  RETURN QUERY
  SELECT 
    e.sender,
    COUNT(*) as count,
    CASE 
      WHEN total_emails > 0 THEN ROUND((COUNT(*) * 100.0 / total_emails), 1)
      ELSE 0
    END as percentage
  FROM emails e
  WHERE e.user_id = get_sender_statistics.user_id
  GROUP BY e.sender
  ORDER BY COUNT(*) DESC;
END;
$$;

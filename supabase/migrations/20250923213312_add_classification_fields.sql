-- Add classification fields to emails table for adaptive summarization
ALTER TABLE emails 
ADD COLUMN IF NOT EXISTS email_type text,
ADD COLUMN IF NOT EXISTS urgency_level text,
ADD COLUMN IF NOT EXISTS action_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS classification_confidence decimal(3,2),
ADD COLUMN IF NOT EXISTS estimated_read_time integer;

-- Add index for filtering by email type
CREATE INDEX IF NOT EXISTS emails_type_urgency_idx ON emails(email_type, urgency_level);

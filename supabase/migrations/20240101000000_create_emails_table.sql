-- Create emails table to store Gmail messages and AI summaries
CREATE TABLE IF NOT EXISTS emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_id text NOT NULL,
  sender text NOT NULL,
  subject text NOT NULL,
  summary text,
  body_preview text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  read boolean DEFAULT false,
  -- Classification fields for adaptive summarization
  email_type text,
  urgency_level text,
  action_required boolean DEFAULT false,
  classification_confidence decimal(3,2),
  estimated_read_time integer,
  CONSTRAINT emails_gmail_id_user_unique UNIQUE(gmail_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Create policy so users can only access their own emails
CREATE POLICY "Users can only access their own emails" ON emails
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS emails_user_id_created_at_idx ON emails(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS emails_gmail_id_idx ON emails(gmail_id);
CREATE INDEX IF NOT EXISTS emails_type_urgency_idx ON emails(email_type, urgency_level);

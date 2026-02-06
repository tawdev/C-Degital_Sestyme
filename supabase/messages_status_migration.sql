-- Add status tracking columns to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('sent', 'delivered', 'seen')) DEFAULT 'sent';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;

-- Migrate existing messages
UPDATE public.messages 
SET status = 'seen',
    sent_at = created_at,
    delivered_at = created_at,
    seen_at = created_at
WHERE status = 'sent'; -- Assuming existing 'sent' (default) were actually read if they are old

-- Add index for performance on status queries
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages (conversation_id, status);

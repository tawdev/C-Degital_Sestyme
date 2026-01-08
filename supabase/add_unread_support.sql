-- Add is_read column to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Update RLS for messages to allow marking as read
-- Admin can already do everything.
-- Employee needs to be able to UPDATE their own messages (as recipient) to mark as read.
-- Actually, it's easier to just use an RPC or adminClient for this to avoid complex RLS on UPDATE.
-- But if we want RLS:
CREATE POLICY employee_mark_as_read ON public.messages
    FOR UPDATE
    TO authenticated
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());

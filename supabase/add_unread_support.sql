-- 1. Add missing columns and enable full replication for Realtime
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 2. Populate recipient_id for existing messages
-- Logic: The recipient is the participant who is NOT the sender.
UPDATE public.messages m
SET recipient_id = (
    SELECT CASE 
        WHEN c.user1_id = m.sender_id THEN c.user2_id 
        ELSE c.user1_id 
    END
    FROM public.conversations c 
    WHERE c.id = m.conversation_id
)
WHERE recipient_id IS NULL;

-- 3. Add index for performance
CREATE INDEX IF NOT EXISTS idx_messages_unread 
ON public.messages (recipient_id, is_read, conversation_id);

-- 4. Update RLS for messages to allow marking as read
-- Admin can already do everything (see existing policy).
-- We need a policy allowing users to update is_read if they are the recipient.
DROP POLICY IF EXISTS employee_mark_as_read ON public.messages;
CREATE POLICY employee_mark_as_read ON public.messages
    FOR UPDATE
    TO authenticated
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());

-- 5. Enable Realtime for the updated table if not already
-- (Usually done via Dashboard, but this is a reminder)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

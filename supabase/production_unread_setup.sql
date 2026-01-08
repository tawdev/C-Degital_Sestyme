-- ==========================================
-- PRODUCTION-GRADE UNREAD MESSAGES SYSTEM
-- ==========================================

-- 1. Add recipient_id to messages for high-performance RLS and counting
-- This avoids joining the conversations table on every check.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;

-- 2. Add is_read column 
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- 3. PERFORMANCE: Add a partial index for unread messages
-- This makes counting unread messages for a specific user extremely fast.
CREATE INDEX IF NOT EXISTS idx_messages_unread 
ON public.messages (recipient_id) 
WHERE (is_read = FALSE);

-- 4. MIGRATE: Populate recipient_id for existing messages
UPDATE public.messages m
SET recipient_id = CASE 
    WHEN m.sender_id = c.user1_id THEN c.user2_id 
    ELSE c.user1_id 
END
FROM public.conversations c
WHERE m.conversation_id = c.id AND m.recipient_id IS NULL;

-- 5. SECURITY: RLS Updates
DROP POLICY IF EXISTS messages_mark_as_read_v2 ON public.messages;
DROP POLICY IF EXISTS employee_mark_as_read ON public.messages;

-- Refined UPDATE Policy: ONLY the recipient can mark a message as read.
CREATE POLICY messages_mark_as_read_v3 ON public.messages
    FOR UPDATE
    TO authenticated
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());

-- 6. REALTIME: Ensure messages table is trackable
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;

-- ==========================================
-- REALTIME SUPER FIX: Unread Messages
-- ==========================================

-- 1. Ensure Columns Exist
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- 2. REPLICA IDENTITY: Crucial for UPDATE events to include non-PK columns in filters
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 3. REALTIME PUBLICATION: Ensure the table is included
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;

-- 4. PERFORMANCE: Partial index for unread count
CREATE INDEX IF NOT EXISTS idx_messages_unread_v2 
ON public.messages (recipient_id) 
WHERE (is_read = FALSE);

-- 5. RELOAD SCHEMA CACHE: Force PostgREST to notice column changes
NOTIFY pgrst, 'reload schema';

-- 6. VERIFY RLS: Ensure recipient can see messages for Realtime broadcasting
DROP POLICY IF EXISTS employee_p2p_messages_select ON public.messages;
CREATE POLICY employee_p2p_messages_select_v2 ON public.messages
    FOR SELECT
    TO authenticated
    USING (
        sender_id = auth.uid() OR
        recipient_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE id = messages.conversation_id AND (user1_id = auth.uid() OR user2_id = auth.uid())
        )
    );

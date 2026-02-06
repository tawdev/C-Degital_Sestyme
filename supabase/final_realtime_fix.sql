-- ==========================================
-- FINAL REALTIME FIX (VERSION 2)
-- ==========================================

-- 1. Ensure tables have full replica identity (required for some Realtime events to show old/new data)
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;

-- 2. Safely add tables to the publication if they aren't already there
-- We use a DO block to avoid syntax errors if they already exist or if DROP fails
DO $$
BEGIN
    -- Add messages
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    -- Add conversations
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;

    -- Add participants
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_participants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
    END IF;
END $$;

-- 3. Verify RLS for messages (Standard Realtime requires SELECT permissions)
DROP POLICY IF EXISTS realtime_messages_select ON public.messages;
CREATE POLICY realtime_messages_select ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
        )
    );

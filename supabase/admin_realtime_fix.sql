-- ======================================================
-- ADMIN REALTIME ACCESS FIX
-- Allows Administrators to receive Realtime events even
-- if they are not explicit participants (Monitoring Mode)
-- ======================================================

-- 1. Drop existing restricted policy
DROP POLICY IF EXISTS realtime_messages_select ON public.messages;

-- 2. Create inclusive policy (Participants OR Admins)
CREATE POLICY realtime_messages_select ON public.messages
    FOR SELECT USING (
        -- Option A: User is an explicit participant
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
        )
        OR 
        -- Option B: User is an Administrator
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND (role = 'Administrator' OR role = 'admin')
        )
    );

-- 3. Ensure REPLICA IDENTITY FULL for all relevant tables
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.employees REPLICA IDENTITY FULL;

-- 4. Verify Publication
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;

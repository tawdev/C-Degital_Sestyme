-- ==========================================
-- SUPER FIX: Realtime & Performance
-- ==========================================

-- 1. Optimize messages table for direct access
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.employees(id);

-- 2. Migrate existing recipient IDs (Best effort)
UPDATE public.messages m
SET recipient_id = CASE 
    WHEN c.user1_id = m.sender_id THEN c.user2_id 
    ELSE c.user1_id 
END
FROM public.conversations c
WHERE m.conversation_id = c.id AND m.recipient_id IS NULL;

-- 3. Simplified RLS (No JOINs/EXISTS - Faster for Realtime)
DROP POLICY IF EXISTS admin_all_messages ON public.messages;
DROP POLICY IF EXISTS employee_p2p_messages_select ON public.messages;
DROP POLICY IF EXISTS employee_p2p_messages_insert ON public.messages;

-- ADMIN
CREATE POLICY admin_all_messages ON public.messages
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.employees WHERE id = auth.uid() AND role = 'Administrator'));

-- PEER-TO-PEER (Direct check is 100% reliable for Realtime)
CREATE POLICY p2p_messages_select ON public.messages
    FOR SELECT TO authenticated
    USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY p2p_messages_insert ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = sender_id);

-- 4. Re-enable Realtime with High Fidelity
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;

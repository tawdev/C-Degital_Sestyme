-- ==========================================
-- FINAL FIX: RLS RECURSION & MESSAGE VISIBILITY
-- ==========================================

-- 1. CREATE A SECURITY DEFINER FUNCTION
-- This breaks the "infinite recursion" because the function bypasses RLS
-- when it queries conversation_participants.
CREATE OR REPLACE FUNCTION public.check_is_participant(chat_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_id = chat_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RESET POLICIES FOR PARTICIPANTS
ALTER TABLE public.conversation_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see participants of their conversations" ON public.conversation_participants;
CREATE POLICY "Users can see participants of their conversations" ON public.conversation_participants
    FOR SELECT USING (
        user_id = auth.uid() -- Can see yourself
        OR 
        public.check_is_participant(conversation_id) -- Can see others if you are in the same chat
        OR 
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- 3. RESET POLICIES FOR CONVERSATIONS
DROP POLICY IF EXISTS "Users can see conversations they are part of" ON public.conversations;
CREATE POLICY "Users can see conversations they are part of" ON public.conversations
    FOR SELECT USING (
        user1_id = auth.uid() OR 
        user2_id = auth.uid() OR
        public.check_is_participant(id)
        OR 
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- 4. RESET POLICIES FOR MESSAGES
DROP POLICY IF EXISTS "Users can see messages of their conversations" ON public.messages;
CREATE POLICY "Users can see messages of their conversations" ON public.messages
    FOR SELECT USING (
        sender_id = auth.uid() OR
        recipient_id = auth.uid() OR
        public.check_is_participant(conversation_id)
        OR 
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- 5. RE-VERIFY INSERT POLICY
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
CREATE POLICY "Users can send messages to their conversations" ON public.messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND (
            recipient_id IS NOT NULL OR -- P2P
            public.check_is_participant(conversation_id) -- Group
        )
    );

-- 6. GRANT PERMISSION TO USE THE FUNCTION
GRANT EXECUTE ON FUNCTION public.check_is_participant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_participant(UUID) TO service_role;

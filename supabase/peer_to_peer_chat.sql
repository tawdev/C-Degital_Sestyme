-- ==========================================
-- TRANSITION: Peer-to-Peer Chat
-- ==========================================

-- 1. Modify conversations table to support p2p
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user1_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user2_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;

-- 2. Migrate existing conversations (Assume the current employee_id was talking to the first Admin found, or a default)
-- For existing records where user1_id is NULL:
-- We'll set user1_id to the existing employee_id and user2_id to a designated Admin or the first Admin.
UPDATE public.conversations 
SET user1_id = employee_id,
    user2_id = (SELECT id FROM public.employees WHERE role = 'Administrator' LIMIT 1)
WHERE user1_id IS NULL;

-- 3. Cleanup: Make user1_id and user2_id NOT NULL and remove old employee_id column
-- First, ensure every record has participants
DELETE FROM public.conversations WHERE user1_id IS NULL OR user2_id IS NULL;

ALTER TABLE public.conversations ALTER COLUMN user1_id SET NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN user2_id SET NOT NULL;

-- Remove old constraint and column
ALTER TABLE public.conversations DROP COLUMN IF EXISTS employee_id CASCADE;

-- 4. Add uniqueness and validation
ALTER TABLE public.conversations ADD CONSTRAINT user1_user2_not_same CHECK (user1_id != user2_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_p2p_conversation ON public.conversations (
    LEAST(user1_id, user2_id), 
    GREATEST(user1_id, user2_id)
);

-- 5. Update RLS for conversations
DROP POLICY IF EXISTS admin_all_conversations ON public.conversations;
DROP POLICY IF EXISTS employee_own_conversation ON public.conversations;

-- ADMIN: Can see all (remains the same)
CREATE POLICY admin_all_conversations ON public.conversations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- EMPLOYEE: Can see conversations where they are a participant
CREATE POLICY employee_p2p_conversation ON public.conversations
    FOR SELECT
    TO authenticated
    USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- 6. Update RLS for messages
DROP POLICY IF EXISTS admin_all_messages ON public.messages;
DROP POLICY IF EXISTS employee_own_messages_select ON public.messages;
DROP POLICY IF EXISTS employee_own_messages_insert ON public.messages;

-- ADMIN: Can see all
CREATE POLICY admin_all_messages ON public.messages
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- EMPLOYEE: Can see messages in their p2p conversation
CREATE POLICY employee_p2p_messages_select ON public.messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE id = messages.conversation_id AND (user1_id = auth.uid() OR user2_id = auth.uid())
        )
    );

CREATE POLICY employee_p2p_messages_insert ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE id = messages.conversation_id AND (user1_id = auth.uid() OR user2_id = auth.uid())
        )
    );

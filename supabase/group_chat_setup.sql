-- ==========================================
-- GROUP CHAT SUPPORT
-- ==========================================

-- 1. Modify conversations table
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.employees(id);

-- Make user1_id and user2_id optional for group conversations
ALTER TABLE public.conversations ALTER COLUMN user1_id DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN user2_id DROP NOT NULL;

-- 2. Create participants table
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(conversation_id, user_id)
);

-- 3. Update messages table to allow group messages
-- recipient_id is already nullable effectively? Let's check. 
-- Actually, let's make it explicitly nullable and add conversation_id as a strong filter.
ALTER TABLE public.messages ALTER COLUMN recipient_id DROP NOT NULL;

-- 4. Enable RLS on participants
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- 5. Migration: For existing P2P chats, add participants automatically
-- This ensures the new participant-based RLS works for old chats too.
INSERT INTO public.conversation_participants (conversation_id, user_id)
SELECT id, user1_id FROM public.conversations
ON CONFLICT DO NOTHING;

INSERT INTO public.conversation_participants (conversation_id, user_id)
SELECT id, user2_id FROM public.conversations
ON CONFLICT DO NOTHING;

-- 6. Update RLS Policies

-- Participant policies
DROP POLICY IF EXISTS "Users can see participants of their conversations" ON public.conversation_participants;
CREATE POLICY "Users can see participants of their conversations" ON public.conversation_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants AS cp
            WHERE cp.conversation_id = conversation_participants.conversation_id
            AND cp.user_id = auth.uid()
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- Update Conversation Selection
DROP POLICY IF EXISTS employee_p2p_conversation ON public.conversations;
DROP POLICY IF EXISTS "Users can see conversations they are part of" ON public.conversations;
CREATE POLICY "Users can see conversations they are part of" ON public.conversations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = conversations.id AND user_id = auth.uid()
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- Update Message Selection
DROP POLICY IF EXISTS employee_p2p_messages_select ON public.messages;
DROP POLICY IF EXISTS "Users can see messages of their conversations" ON public.messages;
CREATE POLICY "Users can see messages of their conversations" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- Update Message Insertion
DROP POLICY IF EXISTS employee_p2p_messages_insert ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
CREATE POLICY "Users can send messages to their conversations" ON public.messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
        )
    );

-- Enable Realtime for participants
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'conversation_participants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
    END IF;
END $$;

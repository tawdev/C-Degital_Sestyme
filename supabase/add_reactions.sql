-- Create reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(message_id, user_id, emoji) -- User can only have one of each emoji per message
);

-- Enable RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Policies
-- SELECT: Visible if you can see the conversation/message
-- Instead of complex join, we can just say "If you are authenticated, you can see reactions".
-- Or cleaner: "If you can select the message, you can select the reaction".
-- Supabase doesn't support "IF can select message".
-- So we replicate the "participant in conversation" logic.

CREATE POLICY "View reactions if participant" ON public.message_reactions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversations c ON c.id = m.conversation_id
            WHERE m.id = message_reactions.message_id
            AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        )
        OR
        EXISTS (
             SELECT 1 FROM public.employees
             WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- INSERT: Only your own userId
CREATE POLICY "Insert own reaction" ON public.message_reactions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
    );

-- DELETE: Only your own userId
CREATE POLICY "Delete own reaction" ON public.message_reactions
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
    );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

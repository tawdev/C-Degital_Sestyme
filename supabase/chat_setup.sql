-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(employee_id) -- Only one conversation per employee with ADMIN
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'employee')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS for conversations
-- ADMIN: can see all conversations
CREATE POLICY admin_all_conversations ON public.conversations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- EMPLOYEE: can see only their own conversation
CREATE POLICY employee_own_conversation ON public.conversations
    FOR SELECT
    TO authenticated
    USING (employee_id = auth.uid());

-- RLS for messages
-- ADMIN: can see all messages and insert new ones
CREATE POLICY admin_all_messages ON public.messages
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- EMPLOYEE: can see messages in their conversation and insert new ones
CREATE POLICY employee_own_messages_select ON public.messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE id = messages.conversation_id AND employee_id = auth.uid()
        )
    );

CREATE POLICY employee_own_messages_insert ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE id = messages.conversation_id AND employee_id = auth.uid()
        )
    );

-- Enable Realtime for messages
-- Note: You need to add 'messages' to the 'supabase_realtime' publication
-- This is usually done via Supabase Dashboard or a specific SQL command if permissions allow
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

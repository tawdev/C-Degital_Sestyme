-- Create meeting_messages table for persistent chat
CREATE TABLE IF NOT EXISTS public.meeting_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    sender_avatar TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.meeting_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Participants can view meeting messages" 
ON public.meeting_messages FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.meetings 
        WHERE id = meeting_messages.meeting_id AND (
            host_id = auth.uid() OR 
            EXISTS (
                SELECT 1 FROM public.meeting_participants 
                WHERE meeting_id = meeting_messages.meeting_id AND user_id = auth.uid()
            )
        )
    ) OR
    EXISTS (
        SELECT 1 FROM public.employees 
        WHERE id = auth.uid() AND role = 'Administrator'
    )
);

CREATE POLICY "Participants can insert meeting messages" 
ON public.meeting_messages FOR INSERT 
TO authenticated 
WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.meetings 
        WHERE id = meeting_messages.meeting_id AND (
            host_id = auth.uid() OR 
            EXISTS (
                SELECT 1 FROM public.meeting_participants 
                WHERE meeting_id = meeting_messages.meeting_id AND user_id = auth.uid()
            )
        )
    )
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_messages;

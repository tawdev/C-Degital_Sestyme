-- 1. Create a Security Definer function to check participant status
-- This bypasses RLS and breaks the infinite recursion between meetings and meeting_participants
CREATE OR REPLACE FUNCTION public.is_meeting_participant(meeting_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.meeting_participants
        WHERE meeting_id = meeting_id_param AND user_id = user_id_param
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Update meetings policy to use the non-recursive function
DROP POLICY IF EXISTS "Participants can view their meetings" ON public.meetings;
CREATE POLICY "Participants can view their meetings" 
ON public.meetings FOR SELECT 
TO authenticated 
USING (
    host_id = auth.uid() OR 
    public.is_meeting_participant(id, auth.uid()) OR
    EXISTS (
        SELECT 1 FROM public.employees 
        WHERE id = auth.uid() AND role = 'Administrator'
    )
);

-- 3. Update meeting_participants policy to use a simpler check
DROP POLICY IF EXISTS "View participants of joined meetings" ON public.meeting_participants;
CREATE POLICY "View participants of joined meetings" 
ON public.meeting_participants FOR SELECT 
TO authenticated 
USING (
    user_id = auth.uid() OR 
    (SELECT host_id FROM public.meetings WHERE id = meeting_id) = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.employees 
        WHERE id = auth.uid() AND role = 'Administrator'
    )
);

-- 4. Fix meeting_messages policies
DROP POLICY IF EXISTS "Participants can view meeting messages" ON public.meeting_messages;
CREATE POLICY "Participants can view meeting messages" 
ON public.meeting_messages FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.meetings 
        WHERE id = meeting_messages.meeting_id AND (
            host_id = auth.uid() OR 
            public.is_meeting_participant(meeting_messages.meeting_id, auth.uid())
        )
    ) OR
    EXISTS (
        SELECT 1 FROM public.employees 
        WHERE id = auth.uid() AND role = 'Administrator'
    )
);

-- 5. Safe Realtime Publication check
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'meeting_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_messages;
    END IF;
END $$;

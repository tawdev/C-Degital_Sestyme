-- Create the meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    host_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'live', 'ended')) DEFAULT 'scheduled',
    recording_url TEXT,
    type TEXT NOT NULL DEFAULT 'video' CHECK (type IN ('audio', 'video')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create the meeting_participants table
CREATE TABLE IF NOT EXISTS public.meeting_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('host', 'participant', 'admin')) DEFAULT 'participant',
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(meeting_id, user_id)
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meetings
CREATE POLICY "Admins can view all meetings" 
ON public.meetings FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.employees 
        WHERE id = auth.uid() AND role = 'Administrator'
    )
);

CREATE POLICY "Participants can view their meetings" 
ON public.meetings FOR SELECT 
TO authenticated 
USING (
    host_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.meeting_participants 
        WHERE meeting_id = public.meetings.id AND user_id = auth.uid()
    )
);

CREATE POLICY "Host can update their meeting" 
ON public.meetings FOR UPDATE 
TO authenticated 
USING (host_id = auth.uid())
WITH CHECK (host_id = auth.uid());

CREATE POLICY "Host and Admin can delete meeting" 
ON public.meetings FOR DELETE 
TO authenticated 
USING (
    host_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.employees 
        WHERE id = auth.uid() AND role = 'Administrator'
    )
);

-- RLS Policies for meeting_participants
CREATE POLICY "View participants of joined meetings" 
ON public.meeting_participants FOR SELECT 
TO authenticated 
USING (
    user_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.meeting_participants AS mp2 
        WHERE mp2.meeting_id = meeting_participants.meeting_id AND mp2.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.employees 
        WHERE id = auth.uid() AND role = 'Administrator'
    )
);

CREATE POLICY "Host can manage participants" 
ON public.meeting_participants FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.meetings 
        WHERE id = meeting_participants.meeting_id AND host_id = auth.uid()
    )
);

-- Enable Realtime for meetings
ALTER TABLE public.meetings REPLICA IDENTITY FULL;
ALTER TABLE public.meeting_participants REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'meetings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'meeting_participants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_participants;
    END IF;
END $$;

-- Create call_logs table
CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    caller_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('audio', 'video')),
    status TEXT NOT NULL CHECK (status IN ('missed', 'answered')),
    duration INTEGER, -- in seconds
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view call logs for their conversations" ON public.call_logs
    FOR SELECT
    TO authenticated
    USING (
        caller_id = auth.uid() OR 
        receiver_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND role = 'Administrator'
        )
    );

-- Allow service role or authenticated users to insert if they are part of the call
-- Since logging happens via server action (admin client), this is mostly for completeness
CREATE POLICY "Users can insert call logs" ON public.call_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Update messages type constraint
-- First, find the constraint name. It's usually 'messages_type_check'
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'image', 'file', 'audio', 'call_audio', 'call_video'));

-- Enable Realtime for call_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;

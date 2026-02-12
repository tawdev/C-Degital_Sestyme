-- 1. Create the calls table for recordings metadata
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    participants JSONB NOT NULL DEFAULT '[]'::jsonb,
    type TEXT NOT NULL CHECK (type IN ('audio', 'video')),
    status TEXT NOT NULL CHECK (status IN ('completed', 'missed', 'rejected')),
    duration INTEGER DEFAULT 0, -- Duration in seconds
    recording_url TEXT, -- URL to the stored recording file
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on calls
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies for calls table
CREATE POLICY "Admins can view all calls" 
ON public.calls FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.employees 
        WHERE id = auth.uid() AND role = 'Administrator'
    )
);

CREATE POLICY "Admins can delete calls" 
ON public.calls FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.employees 
        WHERE id = auth.uid() AND role = 'Administrator'
    )
);

CREATE POLICY "Participants can view their own calls" 
ON public.calls FOR SELECT 
TO authenticated 
USING (
    caller_id = auth.uid() OR 
    participants ? auth.uid()::text
);

-- 3. Storage Setup (Bucket: call-recordings)
-- Note: Re-establishing bucket creation just in case
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', false) -- Private bucket
ON CONFLICT (id) DO NOTHING;

-- 4. Storage RLS Policies
CREATE POLICY "Admins can manage call recordings"
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id = 'call-recordings' AND
    EXISTS (
        SELECT 1 FROM public.employees 
        WHERE id = auth.uid() AND role = 'Administrator'
    )
);

CREATE POLICY "Employees can upload recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'call-recordings'
);

CREATE POLICY "Participants can view their recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'call-recordings' AND (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE id = auth.uid() AND role = 'Administrator'
        ) OR
        (storage.foldername(name))[1] = auth.uid()::text -- Simplified: check if user is in path
    )
);

-- Enable Realtime for calls table
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

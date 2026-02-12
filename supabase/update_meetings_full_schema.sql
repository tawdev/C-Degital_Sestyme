-- ======================================================
-- MEETINGS SCHEMA UPDATE
-- ======================================================

-- 1. Add missing columns to meetings table
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS cron_iban JSONB;

-- 2. Ensure created_by exists (as an alias or column)
-- Given the prompt asks for created_by, we'll add it if it doesn't exist, 
-- or use host_id as the primary reference.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='meetings' AND COLUMN_NAME='created_by') THEN
        ALTER TABLE public.meetings ADD COLUMN created_by UUID REFERENCES public.employees(id);
    END IF;
END $$;

-- 3. Update status check to include preferred naming
ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_status_check;
ALTER TABLE public.meetings ADD CONSTRAINT meetings_status_check CHECK (status IN ('planned', 'ongoing', 'ended', 'scheduled', 'live'));

-- 4. Update meeting_notifications to align with prompt
ALTER TABLE public.meeting_notifications 
ADD COLUMN IF NOT EXISTS sound TEXT DEFAULT 'default';

-- 5. Enable RLS and Realtime (Refresher)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_notifications ENABLE ROW LEVEL SECURITY;

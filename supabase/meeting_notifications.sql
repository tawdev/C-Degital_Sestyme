-- ======================================================
-- MEETING NOTIFICATIONS SCHEMA
-- ======================================================

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.meeting_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    seen BOOLEAN DEFAULT false,
    scheduled_at TIMESTAMPTZ NOT NULL, -- Date/heure du meeting pour les rappels
    trigger_at TIMESTAMPTZ NOT NULL,   -- Date/heure à laquelle la notification doit être envoyée
    type TEXT NOT NULL CHECK (type IN ('immediate', 'reminder_10min', 'reminder_exact')),
    sound TEXT DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_notifications;

-- 3. Enable RLS
ALTER TABLE public.meeting_notifications ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.meeting_notifications;
CREATE POLICY "Users can view own notifications" ON public.meeting_notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.meeting_notifications;
CREATE POLICY "Users can update own notifications" ON public.meeting_notifications
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Grant Permissions
GRANT ALL ON TABLE public.meeting_notifications TO authenticated;
GRANT ALL ON TABLE public.meeting_notifications TO service_role;

-- 6. Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_meeting_notifications_user_seen ON public.meeting_notifications(user_id, seen);
CREATE INDEX IF NOT EXISTS idx_meeting_notifications_trigger_at ON public.meeting_notifications(trigger_at) WHERE seen = false;

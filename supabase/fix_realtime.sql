-- ==========================================
-- FIX: Realtime Updates
-- ==========================================

-- 1. Ensure the table has REPLICA IDENTITY FULL
-- This ensures that the insert/update payloads 
-- contain all the necessary data for the UI.
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 2. Force add to publication (in case it was missed or errored)
-- We use a DO block to handle cases where it might already be added
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;

-- 3. Verify RLS (Ensuring SELECT is allowed for the channel to work)
-- This was already in our scripts, but we repeat it to be safe.
-- The channel requires SELECT permission to broadcast the payload to the user.
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

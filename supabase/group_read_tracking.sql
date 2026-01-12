-- ==========================================
-- GROUP CHAT READ TRACKING
-- ==========================================

-- 1. Add last_read_at to participants
ALTER TABLE public.conversation_participants 
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 2. Update existing participants to mark everything as read initially 
-- (optional but prevents flood of old unread counts)
UPDATE public.conversation_participants SET last_read_at = timezone('utc'::text, now()) WHERE last_read_at IS NULL;

-- 3. Cleanup: We keep is_read on messages for P2P compatibility 
-- but we primarily rely on last_read_at for participants from now on.

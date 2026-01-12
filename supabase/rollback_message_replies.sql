-- ==========================================
-- ROLLBACK: MESSAGE REPLY SUPPORT
-- ==========================================

-- 1. Drop index
DROP INDEX IF EXISTS public.idx_messages_reply_to_id;

-- 2. Drop reply_to_id column
ALTER TABLE public.messages 
DROP COLUMN IF EXISTS reply_to_id;

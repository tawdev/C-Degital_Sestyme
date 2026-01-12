-- ===========================================
-- IMPROVE CHAT SORTING AND LAST MESSAGE CACHING
-- ===========================================

-- 1. Add columns to conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_content TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_sender_id UUID REFERENCES public.employees(id);

-- 2. Initialize existing conversations with the latest message info
UPDATE public.conversations c
SET 
  last_message_at = m.created_at,
  last_message_content = CASE 
      WHEN m.type = 'text' THEN m.content 
      WHEN m.type = 'image' THEN '📷 Image'
      WHEN m.type = 'audio' THEN '🎤 Voice message'
      ELSE '📎 Attachment'
  END,
  last_message_sender_id = m.sender_id
FROM (
  SELECT DISTINCT ON (conversation_id) *
  FROM public.messages
  ORDER BY conversation_id, created_at DESC
) m
WHERE c.id = m.conversation_id;

-- 3. Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_message_sync()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_content = CASE 
      WHEN NEW.type = 'text' THEN NEW.content 
      WHEN NEW.type = 'image' THEN '📷 Image'
      WHEN NEW.type = 'audio' THEN '🎤 Voice message'
      ELSE '📎 Attachment'
    END,
    last_message_sender_id = NEW.sender_id
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS on_message_inserted ON public.messages;
CREATE TRIGGER on_message_inserted
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.handle_new_message_sync();

-- 5. Add index for faster sorting
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);

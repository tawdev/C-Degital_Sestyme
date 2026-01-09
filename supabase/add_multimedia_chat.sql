-- 1. Update messages table to support multimedia
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'audio')),
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER, -- in bytes
ADD COLUMN IF NOT EXISTS duration INTEGER; -- in seconds, for audio

-- 2. Create Storage Bucket for Attachments
-- Note: usage of insert into storage.buckets requires appropriate permissions or run via dashboard SQL editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('messages-attachments', 'messages-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'messages-attachments' );

-- Allow authenticated users to download/view files
CREATE POLICY "Authenticated users can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'messages-attachments' );

-- Optional: Allow users to delete their own files? 
-- For now, let's keep it simple. Only upload and view.

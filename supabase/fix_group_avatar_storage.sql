-- Fix storage bucket permissions for group avatar uploads
-- This ensures the messages-attachments bucket exists and has proper permissions

-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('messages-attachments', 'messages-attachments', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin All Access" ON storage.objects;
DROP POLICY IF EXISTS "Employees Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public View" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;

-- Policy: Allow all authenticated users to upload to messages-attachments bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'messages-attachments'
);

-- Policy: Allow admins to do everything
CREATE POLICY "Admin All Access"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'messages-attachments'
  AND auth.uid() IN (SELECT id FROM employees WHERE role = 'Administrator')
)
WITH CHECK (
  bucket_id = 'messages-attachments'
  AND auth.uid() IN (SELECT id FROM employees WHERE role = 'Administrator')
);

-- Policy: Public can view all files (since bucket is public)
CREATE POLICY "Public View"
ON storage.objects
FOR SELECT
TO public
USING ( bucket_id = 'messages-attachments' );

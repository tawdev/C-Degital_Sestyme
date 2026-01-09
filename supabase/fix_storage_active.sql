-- Fix: Make the bucket public so that publicUrl works
UPDATE storage.buckets
SET public = true
WHERE id = 'messages-attachments';

-- Ensure the policy allows public access if RLS is still active (usually Public buckets bypass SELECT RLS, but just in case)
DROP POLICY IF EXISTS "Public can view attachments" ON storage.objects;
CREATE POLICY "Public can view attachments"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'messages-attachments' );

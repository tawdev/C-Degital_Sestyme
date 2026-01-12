-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('messages-attachments', 'messages-attachments', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Enable RLS (Commented out as it often causes permission issues if not owner, and is usually enabled by default)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can do anything
CREATE POLICY "Admin All Access"
ON storage.objects
FOR ALL
USING ( 
  auth.uid() IN (SELECT id FROM employees WHERE role = 'Administrator') 
)
WITH CHECK ( 
  auth.uid() IN (SELECT id FROM employees WHERE role = 'Administrator') 
);

-- Policy: Employees can upload to their own folder (or generally to the bucket)
-- Simplification: Authenticated employees can upload
CREATE POLICY "Employees Upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'messages-attachments'
  AND auth.role() = 'authenticated'
);

-- Policy: Public/Anyone can view (since it's a public bucket, this helps for download)
CREATE POLICY "Public View"
ON storage.objects
FOR SELECT
USING ( bucket_id = 'messages-attachments' );

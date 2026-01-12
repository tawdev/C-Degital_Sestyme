-- Enable RLS on messages if not already enabled
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can delete their own messages if they are NOT an administrator
-- This strictly prevents admins from deleting messages, even their own (as per requirement "Administrator: X لا يمكنه حذف أي رسالة")
-- Requirement says: "منع المسؤول (Administrator) من حذف أي رسالة"
-- And for normal users: "حذف الرسائل التي أرسلها بنفسه فقط"

CREATE POLICY "Users can delete own messages if not admin"
ON messages
FOR DELETE
USING (
  auth.uid() = sender_id
  AND NOT EXISTS (
    SELECT 1 FROM employees
    WHERE id = auth.uid()
    AND role = 'Administrator'
  )
);

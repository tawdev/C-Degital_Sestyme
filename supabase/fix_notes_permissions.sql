-- Add permissions for Administrators to access project_notes
-- Fixes "Aucune Note pour le Moment" for Admin users

-- 1. SELECT Policy (Viewing Notes)
CREATE POLICY "Admins can view all notes" ON public.project_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid() AND e.role = 'Administrator'
    )
  );

-- 2. UPDATE Policy (Editing Notes - e.g. for content moderation or validation)
-- Note: Validation is handled by a separate validatNote action using adminClient, 
-- but this allows direct DB edits if needed.
CREATE POLICY "Admins can update all notes" ON public.project_notes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid() AND e.role = 'Administrator'
    )
  );

-- 3. DELETE Policy (Removing Notes)
CREATE POLICY "Admins can delete all notes" ON public.project_notes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid() AND e.role = 'Administrator'
    )
  );

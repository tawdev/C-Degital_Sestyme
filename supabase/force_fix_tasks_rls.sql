-- FORCE FIX: Drops ALL policies on project_tasks dynamically and recreates them
-- This ensures no conflicting policies remain, regardless of their names.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'project_tasks'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_tasks', r.policyname);
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;

-- ==========================================
-- 1. SELECT Policy (Viewing Tasks)
-- ==========================================
CREATE POLICY "Users can view relevant tasks" ON public.project_tasks
  FOR SELECT
  TO authenticated
  USING (
    -- 1. Assignee can view
    assignee_id = auth.uid()
    OR
    -- 2. Project Collaborator can view
    EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_tasks.project_id AND pc.employee_id = auth.uid()
    )
    OR
    -- 3. Project Owner can view
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_tasks.project_id AND p.employee_id = auth.uid()
    )
    OR
    -- 4. Administrator can view
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid() AND e.role = 'Administrator'
    )
  );


-- ==========================================
-- 2. UPDATE Policy (Editing Tasks)
-- ==========================================
CREATE POLICY "Users can update relevant tasks" ON public.project_tasks
  FOR UPDATE
  TO authenticated
  USING (
    -- 1. Assignee can update
    assignee_id = auth.uid()
    OR
    -- 2. Project Owner can update
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_tasks.project_id AND p.employee_id = auth.uid()
    )
    OR
    -- 3. Administrator can update
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid() AND e.role = 'Administrator'
    )
  );

-- ==========================================
-- 3. INSERT Policy (Creating Tasks)
-- ==========================================
CREATE POLICY "Admins and Owners can create tasks" ON public.project_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- 1. Project Owner
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.employee_id = auth.uid()
    )
    OR
    -- 2. Administrator
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid() AND e.role = 'Administrator'
    )
  );

-- ==========================================
-- 4. DELETE Policy (Removing Tasks)
-- ==========================================
CREATE POLICY "Admins and Owners can delete tasks" ON public.project_tasks
  FOR DELETE
  TO authenticated
  USING (
    -- 1. Project Owner
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_tasks.project_id AND p.employee_id = auth.uid()
    )
    OR
    -- 2. Administrator
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid() AND e.role = 'Administrator'
    )
  );

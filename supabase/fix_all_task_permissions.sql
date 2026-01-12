-- Comprehensive fix for Task Permissions (RLS)
-- 1. Drops all existing policies to ensure a clean state
-- 2. Corrects the 'Administrator' role check (was previously 'admin' in some scripts)
-- 3. Explicitly allows Assignees to VIEW and UPDATE their tasks

-- Enable RLS (just in case)
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies for project_tasks to avoid conflicts
DROP POLICY IF EXISTS "authenticated_select_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "authenticated_insert_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "manage_own_tasks_update" ON public.project_tasks;
DROP POLICY IF EXISTS "manage_own_tasks_delete" ON public.project_tasks;
DROP POLICY IF EXISTS "Tasks are viewable by project collaborators" ON public.project_tasks;
DROP POLICY IF EXISTS "Tasks are viewable by project collaborators or assignees" ON public.project_tasks; -- Previous attempt name
DROP POLICY IF EXISTS "Collaborators can update their own tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Collaborators can update their own task status" ON public.project_tasks;
DROP POLICY IF EXISTS "Admins and project owners can manage all tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Admins and project owners can create tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Admins and project owners can delete tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Assignees and collaborators can update tasks" ON public.project_tasks;


-- ==========================================
-- 1. SELECT Policy (Viewing Tasks)
-- ==========================================
CREATE POLICY "Users can view relevant tasks" ON public.project_tasks
  FOR SELECT
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
    -- 4. Administrator can view (Correct Role: 'Administrator')
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
  USING (
    -- 1. Assignee can update (typically status)
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
  WITH CHECK (
    -- 1. Project Owner
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.employee_id = auth.uid() -- Note: Using project_id from the new row
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

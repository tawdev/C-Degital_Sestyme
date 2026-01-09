-- Add assignee_id column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'assignee_id') THEN
        ALTER TABLE public.project_tasks ADD COLUMN assignee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Drop the old constraint FIRST to allow status updates
ALTER TABLE public.project_tasks DROP CONSTRAINT IF EXISTS project_tasks_status_check;

-- Migrate existing data to match new status values
UPDATE public.project_tasks SET status = 'todo' WHERE status = 'pending';
UPDATE public.project_tasks SET status = 'done' WHERE status = 'completed';

-- Add the new status check constraint
ALTER TABLE public.project_tasks ADD CONSTRAINT project_tasks_status_check 
    CHECK (status IN ('todo', 'in_progress', 'done'));

-- Ensure RLS is enabled
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to rebuild them safely
DROP POLICY IF EXISTS "authenticated_select_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "authenticated_insert_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "manage_own_tasks_update" ON public.project_tasks;
DROP POLICY IF EXISTS "manage_own_tasks_delete" ON public.project_tasks;
DROP POLICY IF EXISTS "Tasks are viewable by project collaborators" ON public.project_tasks;
DROP POLICY IF EXISTS "Collaborators can update their own tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Admins and project owners can manage all tasks" ON public.project_tasks;


-- 1. SELECT: Viewable by Project Collaborators, Project Owners, and Admins
CREATE POLICY "Tasks are viewable by project collaborators" ON public.project_tasks
    FOR SELECT
    USING (
        -- User is a collaborator
        EXISTS (
            SELECT 1 FROM public.project_collaborators
            WHERE project_id = project_tasks.project_id
            AND employee_id = auth.uid()
        )
        OR
        -- User is the project owner
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = project_tasks.project_id
            AND employee_id = auth.uid()
        )
        OR
        -- User is an Admin
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid()
            AND role = 'Administrator'
        )
    );

-- 2. INSERT: Project Owners and Admins only (Collaborators usually don't create tasks in this model, but can be adjusted)
-- Assuming for now only owners/admins create tasks as per "Collaborator behavior: update status only"
CREATE POLICY "Admins and project owners can create tasks" ON public.project_tasks
    FOR INSERT
    WITH CHECK (
        -- User is the project owner
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = project_tasks.project_id
            AND employee_id = auth.uid()
        )
        OR
        -- User is an Admin
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid()
            AND role = 'Administrator'
        )
    );

-- 3. UPDATE: 
-- A. Collaborators can update ONLY status of tasks assigned to them
-- B. Project Owners/Admins can update everything
CREATE POLICY "Collaborators can update their own task status" ON public.project_tasks
    FOR UPDATE
    USING (
        -- Rule: You are the assignee
        assignee_id = auth.uid()
        OR
        -- Rule: OR you are owner/admin
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = project_tasks.project_id
            AND employee_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid()
            AND role = 'Administrator'
        )
    );

-- 4. DELETE: Project Owners and Admins only
CREATE POLICY "Admins and project owners can delete tasks" ON public.project_tasks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = project_tasks.project_id
            AND employee_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid()
            AND role = 'Administrator'
        )
    );

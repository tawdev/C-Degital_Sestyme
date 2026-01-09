-- Create project_tasks table
CREATE TABLE IF NOT EXISTS public.project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'completed')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to make the script idempotent
DROP POLICY IF EXISTS "authenticated_select_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "authenticated_insert_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "employee_update_own_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "employee_delete_own_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "manage_own_tasks_update" ON public.project_tasks;
DROP POLICY IF EXISTS "manage_own_tasks_delete" ON public.project_tasks;

-- Select policy: All authenticated users can see tasks
CREATE POLICY "authenticated_select_tasks" ON public.project_tasks
    FOR SELECT
    TO authenticated
    USING (true);

-- Insert policy: Authenticated users can insert tasks
CREATE POLICY "authenticated_insert_tasks" ON public.project_tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Update policy: Project owner or Administrator can update tasks
CREATE POLICY "manage_own_tasks_update" ON public.project_tasks
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND role = 'Administrator'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_tasks.project_id
            AND projects.employee_id = auth.uid()
        )
    );

-- Delete policy: Project owner or Administrator can delete tasks
CREATE POLICY "manage_own_tasks_delete" ON public.project_tasks
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND role = 'Administrator'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = project_tasks.project_id
            AND projects.employee_id = auth.uid()
        )
    );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks(project_id);

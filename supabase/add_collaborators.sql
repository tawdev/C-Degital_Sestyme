-- Create project_collaborators table join table
CREATE TABLE IF NOT EXISTS public.project_collaborators (
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, employee_id)
);

-- Enable RLS
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.project_collaborators;
CREATE POLICY "Enable read access for all authenticated users" ON public.project_collaborators FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable all access for admins" ON public.project_collaborators;
CREATE POLICY "Enable all access for admins" ON public.project_collaborators FOR ALL USING (
    EXISTS (SELECT 1 FROM public.employees WHERE id = auth.uid() AND role = 'Administrator')
);

-- Add assigned_to column to project_tasks if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'assigned_to') THEN
        ALTER TABLE public.project_tasks ADD COLUMN assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Allow 'in_progress' and ensure 'pending'/'completed' are supported.
-- Also allow 'todo'/'done' temporarily to prevent creating errors for any legacy data or in-flight requests, 
-- though we will standardize the frontend to pending/in_progress/completed.

ALTER TABLE public.project_tasks
  DROP CONSTRAINT IF EXISTS project_tasks_status_check;

ALTER TABLE public.project_tasks
  ADD CONSTRAINT project_tasks_status_check 
  CHECK (status IN ('pending', 'in_progress', 'completed', 'todo', 'done'));

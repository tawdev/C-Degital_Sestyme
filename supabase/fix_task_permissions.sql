-- Drop the old SELECT policy that only allowed project collaborators to view tasks
DROP POLICY IF EXISTS "Tasks are viewable by project collaborators" ON project_tasks;

-- Create a new SELECT policy that also allows the assignee of a task to view it
CREATE POLICY "Tasks are viewable by project collaborators or assignees"
  ON project_tasks
  FOR SELECT
  USING (
    -- The user is the assignee of the task
    assignee_id = auth.uid()
    OR
    -- The user is a collaborator on the project
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_id AND pc.employee_id = auth.uid()
    )
    OR
    -- The user is the owner of the project
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND p.employee_id = auth.uid()
    )
    OR
    -- The user is an administrator (employees table contains a role column)
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = auth.uid() AND e.role = 'admin'
    )
  );

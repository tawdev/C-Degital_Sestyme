-- Database Trigger to Sync Project Progress with Tasks
-- This ensures that the 'projects' table is ALWAYS in sync with 'project_tasks', 
-- regardless of where the task update comes from.

-- 1. Create the Function to Calculate and Update Progress
CREATE OR REPLACE FUNCTION calculate_project_progress()
RETURNS TRIGGER AS $$
DECLARE
    project_id_target UUID;
    total_tasks INTEGER;
    completed_tasks INTEGER;
    new_progress INTEGER;
    new_status TEXT;
BEGIN
    -- Determine which project to update. 
    -- If deleting, use OLD.project_id. Otherwise use NEW.project_id.
    IF (TG_OP = 'DELETE') THEN
        project_id_target := OLD.project_id;
    ELSE
        project_id_target := NEW.project_id;
    END IF;

    -- Count total and completed tasks for the project
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed' OR status = 'done')
    INTO total_tasks, completed_tasks
    FROM project_tasks
    WHERE project_id = project_id_target;

    -- Calculate Progress Percentage
    IF total_tasks = 0 THEN
        new_progress := 0;
        new_status := 'pending'; -- Default for empty projects
    ELSE
        new_progress := ROUND((completed_tasks::DECIMAL / total_tasks::DECIMAL) * 100);
        
        -- Determine Status
        IF new_progress = 100 THEN
            new_status := 'completed';
        ELSIF new_progress > 0 THEN
            new_status := 'in_progress';
        ELSE
            new_status := 'pending';
        END IF;
    END IF;

    -- Update the Project Record
    UPDATE projects
    SET 
        progress = new_progress,
        status = new_status,
        end_date = CASE WHEN new_progress = 100 THEN NOW() ELSE end_date END
    WHERE id = project_id_target;

    RETURN NULL; -- Triggers fired AFTER don't need to return a row
END;
$$ LANGUAGE plpgsql;

-- 2. Drop existing trigger if it exists to avoid duplication
DROP TRIGGER IF EXISTS update_project_progress_trigger ON project_tasks;

-- 3. Create the Trigger
CREATE TRIGGER update_project_progress_trigger
AFTER INSERT OR UPDATE OR DELETE ON project_tasks
FOR EACH ROW
EXECUTE FUNCTION calculate_project_progress();

-- 4. FORCE UPDATE ALL EXISTING PROJECTS NOW
-- This fixes the current stale data in your dashboard.
-- We use a single efficient UPDATE instead of a loop to avoid variable conflicts.
UPDATE projects
SET 
    progress = sub.calc_progress,
    status = CASE 
        WHEN sub.calc_progress = 100 THEN 'completed'
        WHEN sub.calc_progress > 0 THEN 'in_progress'
        ELSE 'pending'
    END
FROM (
    SELECT 
        p_inner.id,
        CASE 
            WHEN COUNT(t.id) = 0 THEN 0
            ELSE ROUND((COUNT(t.id) FILTER (WHERE t.status IN ('completed', 'done'))::DECIMAL / COUNT(t.id)::DECIMAL) * 100) 
        END as calc_progress
    FROM projects p_inner
    LEFT JOIN project_tasks t ON p_inner.id = t.project_id
    GROUP BY p_inner.id
) as sub
WHERE projects.id = sub.id;

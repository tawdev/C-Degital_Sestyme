-- Create activities table for tracking user actions
CREATE TABLE IF NOT EXISTS activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_action_type ON activities(action_type);

-- Enable Row Level Security
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all activities
CREATE POLICY "Users can view all activities"
    ON activities FOR SELECT
    USING (true);

-- Policy: Authenticated users can insert activities
CREATE POLICY "Authenticated users can insert activities"
    ON activities FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Insert some sample activities for testing
INSERT INTO activities (user_id, action_type, description, metadata)
SELECT 
    id,
    'created_project',
    'Created a new project',
    jsonb_build_object('project_name', 'Sample Project')
FROM employees
LIMIT 1;

COMMENT ON TABLE activities IS 'Tracks user activities and actions in the system';
COMMENT ON COLUMN activities.action_type IS 'Type of action: created_project, updated_project, completed_task, assigned_employee, etc.';
COMMENT ON COLUMN activities.metadata IS 'Additional JSON data related to the activity';

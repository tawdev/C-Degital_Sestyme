-- Add language and project_size columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_size TEXT;

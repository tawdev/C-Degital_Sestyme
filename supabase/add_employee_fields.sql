-- Add avatar_url and date_of_birth columns to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth DATE;

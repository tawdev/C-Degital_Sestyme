-- Migration: Add password column to employees table
-- Run this in your Supabase SQL Editor if you already created the employees table

-- Add password column (set a default temporary value for existing rows)
ALTER TABLE employees 
ADD COLUMN password TEXT NOT NULL DEFAULT 'changeme123';

-- Remove the default after adding the column
ALTER TABLE employees 
ALTER COLUMN password DROP DEFAULT;

-- Note: You should update passwords for existing employees after running this migration

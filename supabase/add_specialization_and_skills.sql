-- ==========================================
-- ADD SPECIALIZATION AND SKILLS TO EMPLOYEES
-- ==========================================

-- 1. Add specialization column
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS specialization TEXT;

-- 2. Add skills column (using TEXT[] for simple array of strings)
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';

-- 3. Update Comments for documentation
COMMENT ON COLUMN public.employees.specialization IS 'Primary professional focus (e.g., Frontend, Backend, Design, Database)';
COMMENT ON COLUMN public.employees.skills IS 'Array of technical skills associated with the specialization';

-- 4. Reload Schema Cache for PostgREST
NOTIFY pgrst, 'reload schema';

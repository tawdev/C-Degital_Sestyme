-- ==========================================
-- CONVERT SPECIALIZATION TO ARRAY TYPE
-- ==========================================

-- 1. Drop existing column if necessary (or convert)
-- To safely convert, we'll cast the existing values into an array
ALTER TABLE public.employees 
ALTER COLUMN specialization TYPE TEXT[] 
USING CASE 
    WHEN specialization IS NULL THEN '{}'::TEXT[]
    ELSE ARRAY[specialization]
END;

-- 2. Ensure default is an empty array
ALTER TABLE public.employees 
ALTER COLUMN specialization SET DEFAULT '{}';

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload schema';

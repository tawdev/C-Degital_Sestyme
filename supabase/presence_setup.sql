-- Add status columns to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure users can update their own status
-- Note: SELECT policy is already "authenticated_select_employees" (authenticated users can see all employees)
-- Note: UPDATE policy is already "users_update_own_profile" (users can update their own record)

-- ======================================================
-- PUSH NOTIFICATIONS SCHEMA
-- ======================================================

-- 1. Create subscripions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure user doesn't have thousands of subscriptions per browser version 
    -- but allow multiple devices
    UNIQUE(user_id, endpoint)
);

-- 2. Explicitly Grant Permissions
-- This is critical for tables created via SQL Editor to be accessible via PostgREST
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;
GRANT ALL ON TABLE public.push_subscriptions TO anon; -- Allow anon if desync happens, but RLS will still block them

-- 3. Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Users can manage their own subscriptions
-- We check BOTH auth.uid() and Email to handle cases where employees.id and auth.user.id are mismatched.

-- We use a HELPER function to get current user's email safely to avoid session issues
CREATE OR REPLACE FUNCTION get_current_email() 
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'email',
    (SELECT email FROM auth.users WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

DROP POLICY IF EXISTS "Users can select own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can select own subscriptions" ON public.push_subscriptions
    FOR SELECT USING (
        auth.uid() = user_id 
        OR 
        EXISTS (SELECT 1 FROM public.employees WHERE id = user_id AND email = get_current_email())
    );

DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own subscriptions" ON public.push_subscriptions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id 
        OR 
        EXISTS (SELECT 1 FROM public.employees WHERE id = user_id AND email = get_current_email())
    );

DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own subscriptions" ON public.push_subscriptions
    FOR UPDATE USING (
        auth.uid() = user_id 
        OR 
        EXISTS (SELECT 1 FROM public.employees WHERE id = user_id AND email = get_current_email())
    ) WITH CHECK (
        auth.uid() = user_id 
        OR 
        EXISTS (SELECT 1 FROM public.employees WHERE id = user_id AND email = get_current_email())
    );

DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own subscriptions" ON public.push_subscriptions
    FOR DELETE USING (
        auth.uid() = user_id 
        OR 
        EXISTS (SELECT 1 FROM public.employees WHERE id = user_id AND email = get_current_email())
    );

-- 4. Admin can see all subscriptions for debugging
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON public.push_subscriptions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = auth.uid() AND (role = 'Administrator' OR role = 'admin')
        )
    );

-- 5. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_push_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_push_subscription_update ON public.push_subscriptions;
CREATE TRIGGER tr_push_subscription_update
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_push_subscription_timestamp();

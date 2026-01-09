-- FIX SCRIPT: Consolidate User Identity and Fix Permissions (V2 - Robust)
-- This script fixes the issue where 'employees' table IDs do not match Supabase Auth IDs.
-- It handles email conflicts by renaming the old "ghost" users before migration.

DO $$
DECLARE
    v_email_mehdi TEXT := 'mehdi@gmail.com';
    v_email_karim TEXT := 'karim@gmail.com';
    v_auth_id_mehdi UUID;
    v_auth_id_karim UUID;
    v_old_id UUID;
    v_project_id UUID := '5fe1e979-0689-49c6-aaa1-35563aae4429';
BEGIN
    -- =========================================================
    -- 1. FIX MEHDI (Owner)
    -- =========================================================
    
    -- Get Auth ID for Mehdi
    SELECT id INTO v_auth_id_mehdi FROM auth.users WHERE email = v_email_mehdi;
    
    IF v_auth_id_mehdi IS NOT NULL THEN
        RAISE NOTICE 'Found Auth ID for Mehdi: %', v_auth_id_mehdi;

        -- Check for "Ghost" Employee row (Different ID)
        SELECT id INTO v_old_id FROM public.employees WHERE email = v_email_mehdi AND id != v_auth_id_mehdi;
        
        -- A. Handle Conflict: If ghost exists, rename its email to free up the real email
        IF v_old_id IS NOT NULL THEN
            RAISE NOTICE 'Found Ghost Mehdi (%), renaming email...', v_old_id;
            UPDATE public.employees SET email = 'temp_' || v_old_id || '@migrated.com' WHERE id = v_old_id;
        END IF;

        -- B. Create/Update the "Real" Employee Row
        INSERT INTO public.employees (id, full_name, email, role, password)
        VALUES (v_auth_id_mehdi, 'Mehdi', v_email_mehdi, 'Administrator', 'fixed')
        ON CONFLICT (id) DO UPDATE SET role = 'Administrator', email = v_email_mehdi;
        
        -- C. Migrate Data from Ghost to Real
        IF v_old_id IS NOT NULL THEN
            RAISE NOTICE 'Migrating Mehdi data dependencies...';
            -- Update tables referencing employees
            UPDATE public.projects SET employee_id = v_auth_id_mehdi WHERE employee_id = v_old_id;
            UPDATE public.project_tasks SET assignee_id = v_auth_id_mehdi WHERE assignee_id = v_old_id;
            UPDATE public.project_collaborators SET employee_id = v_auth_id_mehdi WHERE employee_id = v_old_id;
            UPDATE public.project_notes SET author_id = v_auth_id_mehdi WHERE author_id = v_old_id;
            
            -- Migrate Messages (Chat)
            UPDATE public.messages SET sender_id = v_auth_id_mehdi WHERE sender_id = v_old_id;
            UPDATE public.messages SET recipient_id = v_auth_id_mehdi WHERE recipient_id = v_old_id;
            
            -- Try migrating direct_messages if table exists (ignore error if not)
            BEGIN
                UPDATE public.direct_messages SET sender_id = v_auth_id_mehdi WHERE sender_id = v_old_id;
                UPDATE public.direct_messages SET receiver_id = v_auth_id_mehdi WHERE receiver_id = v_old_id;
            EXCEPTION WHEN undefined_table THEN 
                RAISE NOTICE 'Table direct_messages does not exist, skipping...';
            END;
            
            -- Delete ghost now that it has no email or children
            DELETE FROM public.employees WHERE id = v_old_id;
        END IF;

        -- Ensure Project Ownership
        UPDATE public.projects SET employee_id = v_auth_id_mehdi WHERE id = v_project_id;
        
    ELSE
        RAISE NOTICE 'WARNING: Mehdi not found in auth.users';
    END IF;


    -- =========================================================
    -- 2. FIX KARIM (Collaborator)
    -- =========================================================

    -- Get Auth ID for Karim
    SELECT id INTO v_auth_id_karim FROM auth.users WHERE email = v_email_karim;
    
    IF v_auth_id_karim IS NOT NULL THEN
        RAISE NOTICE 'Found Auth ID for Karim: %', v_auth_id_karim;
        
        -- Check for "Ghost" Employee row
        v_old_id := NULL; -- Reset
        SELECT id INTO v_old_id FROM public.employees WHERE email = v_email_karim AND id != v_auth_id_karim;

        -- A. Handle Conflict
        IF v_old_id IS NOT NULL THEN
            RAISE NOTICE 'Found Ghost Karim (%), renaming email...', v_old_id;
            UPDATE public.employees SET email = 'temp_' || v_old_id || '@migrated.com' WHERE id = v_old_id;
        END IF;

        -- B. Create/Update the "Real" Employee Row
        INSERT INTO public.employees (id, full_name, email, role, password)
        VALUES (v_auth_id_karim, 'Karim', v_email_karim, 'Employee', 'fixed')
        ON CONFLICT (id) DO UPDATE SET email = v_email_karim;

        -- C. Migrate Data
        IF v_old_id IS NOT NULL THEN
            RAISE NOTICE 'Migrating Karim data dependencies...';
            UPDATE public.projects SET employee_id = v_auth_id_karim WHERE employee_id = v_old_id; 
            UPDATE public.project_tasks SET assignee_id = v_auth_id_karim WHERE assignee_id = v_old_id;
            UPDATE public.project_collaborators SET employee_id = v_auth_id_karim WHERE employee_id = v_old_id;
            UPDATE public.project_notes SET author_id = v_auth_id_karim WHERE author_id = v_old_id;

            -- Migrate Messages (Chat)
            UPDATE public.messages SET sender_id = v_auth_id_karim WHERE sender_id = v_old_id;
            UPDATE public.messages SET recipient_id = v_auth_id_karim WHERE recipient_id = v_old_id;

            -- Try migrating direct_messages if table exists
            BEGIN
                UPDATE public.direct_messages SET sender_id = v_auth_id_karim WHERE sender_id = v_old_id;
                UPDATE public.direct_messages SET receiver_id = v_auth_id_karim WHERE receiver_id = v_old_id;
            EXCEPTION WHEN undefined_table THEN 
                RAISE NOTICE 'Table direct_messages does not exist, skipping...';
            END;
            
            DELETE FROM public.employees WHERE id = v_old_id;
        END IF;
        
        -- Ensure Collaboration
        INSERT INTO public.project_collaborators (project_id, employee_id)
        VALUES (v_project_id, v_auth_id_karim)
        ON CONFLICT DO NOTHING;

        -- Assign 'test1' to Karim
        UPDATE public.project_tasks 
        SET assignee_id = v_auth_id_karim 
        WHERE title = 'test1' AND project_id = v_project_id;
        
    ELSE
        RAISE NOTICE 'WARNING: Karim not found in auth.users';
    END IF;

END $$;

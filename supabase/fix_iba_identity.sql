-- FIX SCRIPT: Consolidate Identity for Iba Ali
-- Fixes visibility issues by ensuring Auth ID matches Employee ID and presence in collaborators table.

DO $$
DECLARE
    v_email_iba TEXT := 'ibaali@gmail.com';
    v_auth_id_iba UUID;
    v_old_id UUID;
    v_project_id UUID := '5fe1e979-0689-49c6-aaa1-35563aae4429';
BEGIN
    -- Get Auth ID for Iba
    SELECT id INTO v_auth_id_iba FROM auth.users WHERE email = v_email_iba;
    
    IF v_auth_id_iba IS NOT NULL THEN
        RAISE NOTICE 'Found Auth ID for Iba: %', v_auth_id_iba;
        
        -- Check for "Ghost" Employee row
        SELECT id INTO v_old_id FROM public.employees WHERE email = v_email_iba AND id != v_auth_id_iba;

        -- A. Handle Conflict (Rename Ghost Email)
        IF v_old_id IS NOT NULL THEN
            RAISE NOTICE 'Found Ghost Iba (%), renaming email...', v_old_id;
            UPDATE public.employees SET email = 'temp_' || v_old_id || '@migrated.com' WHERE id = v_old_id;
        END IF;

        -- B. Create/Update the "Real" Employee Row
        INSERT INTO public.employees (id, full_name, email, role, password)
        VALUES (v_auth_id_iba, 'Iba Ali', v_email_iba, 'Employee', 'fixed')
        ON CONFLICT (id) DO UPDATE SET email = v_email_iba;

        -- C. Migrate Data
        IF v_old_id IS NOT NULL THEN
            RAISE NOTICE 'Migrating Iba data dependencies...';
            UPDATE public.projects SET employee_id = v_auth_id_iba WHERE employee_id = v_old_id; 
            UPDATE public.project_tasks SET assignee_id = v_auth_id_iba WHERE assignee_id = v_old_id;
            UPDATE public.project_collaborators SET employee_id = v_auth_id_iba WHERE employee_id = v_old_id;
            UPDATE public.project_notes SET author_id = v_auth_id_iba WHERE author_id = v_old_id;

            -- Migrate Messages
            UPDATE public.messages SET sender_id = v_auth_id_iba WHERE sender_id = v_old_id;
            UPDATE public.messages SET recipient_id = v_auth_id_iba WHERE recipient_id = v_old_id;

            BEGIN
                UPDATE public.direct_messages SET sender_id = v_auth_id_iba WHERE sender_id = v_old_id;
                UPDATE public.direct_messages SET receiver_id = v_auth_id_iba WHERE receiver_id = v_old_id;
            EXCEPTION WHEN undefined_table THEN 
                NULL;
            END;
            
            DELETE FROM public.employees WHERE id = v_old_id;
        END IF;
        
        -- D. Ensure Collaboration on the Project
        INSERT INTO public.project_collaborators (project_id, employee_id)
        VALUES (v_project_id, v_auth_id_iba)
        ON CONFLICT (project_id, employee_id) DO NOTHING;
        
        RAISE NOTICE 'Iba Ali (Auth ID: %) is now a collaborator on Project %', v_auth_id_iba, v_project_id;
        
    ELSE
        RAISE NOTICE 'WARNING: Iba Ali not found in auth.users';
    END IF;

END $$;

-- ==========================================
-- FIX: Sync Cascades
-- This script allows updating Employee IDs (PK) 
-- by adding ON UPDATE CASCADE to all foreign keys.
-- ==========================================

-- 1. Projects Table
ALTER TABLE public.projects 
DROP CONSTRAINT IF EXISTS projects_employee_id_fkey,
ADD CONSTRAINT projects_employee_id_fkey 
    FOREIGN KEY (employee_id) 
    REFERENCES public.employees(id) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE;

-- 2. Project Notes Table
ALTER TABLE public.project_notes 
DROP CONSTRAINT IF EXISTS project_notes_author_id_fkey,
ADD CONSTRAINT project_notes_author_id_fkey 
    FOREIGN KEY (author_id) 
    REFERENCES public.employees(id) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;

-- 3. Chat Conversations Table
ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_employee_id_fkey,
ADD CONSTRAINT conversations_employee_id_fkey 
    FOREIGN KEY (employee_id) 
    REFERENCES public.employees(id) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;

-- 4. Chat Messages Table
ALTER TABLE public.messages 
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
ADD CONSTRAINT messages_sender_id_fkey 
    FOREIGN KEY (sender_id) 
    REFERENCES public.employees(id) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;

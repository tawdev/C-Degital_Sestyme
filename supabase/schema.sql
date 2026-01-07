-- Create Employees Table
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  role TEXT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Projects Table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  domain_name TEXT,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
  progress INTEGER CHECK (progress >= 0 AND progress <= 100) DEFAULT 0,
  comment TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for Projects Table
-- ============================================

-- ────────────────────────────────────────────
-- SELECT Policies (القراءة)
-- ────────────────────────────────────────────

-- Policy: جميع المستخدمين المصادق عليهم يمكنهم رؤية جميع المشاريع
-- All authenticated users (ADMIN & EMPLOYEE) can view all projects
CREATE POLICY "authenticated_users_select_all_projects" ON projects
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ────────────────────────────────────────────
-- UPDATE Policies (التعديل)
-- ────────────────────────────────────────────

-- Policy: EMPLOYEE يمكنه تعديل مشاريعه فقط
-- Employees can only update their own projects
CREATE POLICY "employee_update_own_projects" ON projects
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM employees 
      WHERE id = auth.uid() 
      AND role != 'Administrator'
    )
    AND employee_id = auth.uid()
  );

-- Policy: ADMIN لا يمكنه التعديل (منع صريح)
-- Admins cannot update any projects (explicit deny)
CREATE POLICY "admin_no_update" ON projects
  FOR UPDATE
  USING (
    auth.uid() NOT IN (
      SELECT id FROM employees 
      WHERE id = auth.uid() 
      AND role = 'Administrator'
    )
  );

-- ────────────────────────────────────────────
-- DELETE Policies (الحذف)
-- ────────────────────────────────────────────

-- Policy: EMPLOYEE يمكنه حذف مشاريعه فقط
-- Employees can only delete their own projects
CREATE POLICY "employee_delete_own_projects" ON projects
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM employees 
      WHERE id = auth.uid() 
      AND role != 'Administrator'
    )
    AND employee_id = auth.uid()
  );

-- Policy: ADMIN لا يمكنه الحذف (منع صريح)
-- Admins cannot delete any projects (explicit deny)
CREATE POLICY "admin_no_delete" ON projects
  FOR DELETE
  USING (
    auth.uid() NOT IN (
      SELECT id FROM employees 
      WHERE id = auth.uid() 
      AND role = 'Administrator'
    )
  );

-- ────────────────────────────────────────────
-- INSERT Policies (الإضافة)
-- ────────────────────────────────────────────

-- Policy: جميع المستخدمين المصادق عليهم يمكنهم إضافة مشاريع
-- All authenticated users can insert projects
CREATE POLICY "authenticated_insert_projects" ON projects
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ────────────────────────────────────────────
-- Employees Table Policies
-- ────────────────────────────────────────────

-- Policy: جميع المستخدمين المصادق عليهم يمكنهم قراءة بيانات الموظفين
-- All authenticated users can read employee data
CREATE POLICY "authenticated_select_employees" ON employees
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: المستخدمون يمكنهم تحديث بياناتهم الخاصة فقط
-- Users can only update their own employee record
CREATE POLICY "users_update_own_profile" ON employees
  FOR UPDATE
  USING (id = auth.uid());

-- ============================================
-- Project Notes System
-- نظام الملاحظات للمشاريع
-- ============================================

-- ────────────────────────────────────────────
-- إضافة حقل التحقق من الملاحظات لجدول المشاريع
-- Add notes validation field to projects table
-- ────────────────────────────────────────────

ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes_validated_at TIMESTAMPTZ;

-- ────────────────────────────────────────────
-- إنشاء جدول الملاحظات
-- Create project_notes table
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────
-- إنشاء Index لتحسين الأداء
-- Create indexes for performance
-- ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_author_id ON project_notes(author_id);

-- ────────────────────────────────────────────
-- Trigger لتحديث updated_at تلقائياً
-- Trigger to auto-update updated_at
-- ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_project_notes_updated_at 
  BEFORE UPDATE ON project_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────
-- تفعيل Row Level Security
-- Enable Row Level Security
-- ────────────────────────────────────────────

ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for project_notes
-- سياسات RLS لجدول الملاحظات
-- ============================================

-- ┌─────────────────────────────────────────┐
-- │ SELECT Policies (القراءة)              │
-- └─────────────────────────────────────────┘

-- Policy: صاحب المشروع + صاحب الملاحظة يمكنهم القراءة
-- Project owner and note author can read notes
CREATE POLICY "project_owner_and_author_select_notes" ON project_notes
  FOR SELECT
  USING (
    -- صاحب الملاحظة يمكنه قراءة ملاحظته
    -- Note author can read their own note
    author_id = auth.uid() 
    OR 
    -- صاحب المشروع يمكنه قراءة جميع ملاحظات مشروعه
    -- Project owner can read all notes on their project
    project_id IN (
      SELECT id FROM projects WHERE employee_id = auth.uid()
    )
  );

-- ┌─────────────────────────────────────────┐
-- │ INSERT Policies (الإضافة)              │
-- └─────────────────────────────────────────┘

-- Policy: أي مستخدم مصادق يمكنه إضافة ملاحظة
-- Any authenticated user can add a note
CREATE POLICY "authenticated_insert_notes" ON project_notes
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND author_id = auth.uid()
  );

-- ┌─────────────────────────────────────────┐
-- │ UPDATE Policies (التعديل)              │
-- └─────────────────────────────────────────┘

-- Policy: صاحب الملاحظة فقط يمكنه تعديل ملاحظته
-- Only note author can update their own note
CREATE POLICY "author_update_own_notes" ON project_notes
  FOR UPDATE
  USING (author_id = auth.uid());

-- ┌─────────────────────────────────────────┐
-- │ DELETE Policies (الحذف)                │
-- └─────────────────────────────────────────┘

-- Policy: صاحب الملاحظة فقط يمكنه حذف ملاحظته
-- Only note author can delete their own note
CREATE POLICY "author_delete_own_notes" ON project_notes
  FOR DELETE
  USING (author_id = auth.uid());


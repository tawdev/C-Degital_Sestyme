'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/auth/actions'

// ────────────────────────────────────────────
// إضافة ملاحظة جديدة
// Add new note
// ────────────────────────────────────────────

export async function addNote(formData: FormData) {
    const projectId = formData.get('project_id') as string
    const content = formData.get('content') as string

    if (!content || content.trim() === '') {
        return { error: 'Note content is required' }
    }

    // الحصول على session المستخدم الحالي
    // Get current user session
    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const supabase = createClient()

    // ────────────────────────────────────────────
    // التحقق من الصلاحية (Validation)
    // ❌ لا يمكن للموظف إضافة ملاحظة على مشروعه
    // ────────────────────────────────────────────
    const { data: project } = await supabase
        .from('projects')
        .select('employee_id')
        .eq('id', projectId)
        .single()

    if (project && project.employee_id === session.id) {
        return { error: 'Unauthorized: You cannot add notes to your own project.' }
    }

    const { error } = await supabase
        .from('project_notes')
        .insert({
            project_id: projectId,
            author_id: session.id,
            content: content.trim()
        })

    if (error) {
        console.error('Error adding note:', error)
        return { error: error.message }
    }

    revalidatePath(`/projects/${projectId}`)
    return { success: true }
}

// ────────────────────────────────────────────
// تعديل ملاحظة
// Update note
// ────────────────────────────────────────────

export async function updateNote(formData: FormData) {
    const noteId = formData.get('note_id') as string
    const projectId = formData.get('project_id') as string
    const content = formData.get('content') as string

    if (!content || content.trim() === '') {
        return { error: 'Note content is required' }
    }

    const supabase = createClient()

    const { error } = await supabase
        .from('project_notes')
        .update({ content: content.trim() })
        .eq('id', noteId)

    if (error) {
        console.error('Error updating note:', error)
        return { error: error.message }
    }

    revalidatePath(`/projects/${projectId}`)
    return { success: true }
}

// ────────────────────────────────────────────
// حذف ملاحظة
// Delete note
// ────────────────────────────────────────────

export async function deleteNote(formData: FormData) {
    const noteId = formData.get('note_id') as string
    const projectId = formData.get('project_id') as string

    const supabase = createClient()

    const { error } = await supabase
        .from('project_notes')
        .delete()
        .eq('id', noteId)

    if (error) {
        console.error('Error deleting note:', error)
        return { error: error.message }
    }

    revalidatePath(`/projects/${projectId}`)
    return { success: true }
}

// ────────────────────────────────────────────
// تأكيد قراءة الملاحظات (صاحب المشروع فقط)
// Validate notes (project owner only)
// ────────────────────────────────────────────

export async function validateNotes(formData: FormData) {
    const projectId = formData.get('project_id') as string

    const supabase = createClient()

    const { error } = await supabase
        .from('projects')
        .update({ notes_validated_at: new Date().toISOString() })
        .eq('id', projectId)

    if (error) {
        console.error('Error validating notes:', error)
        return { error: error.message }
    }

    revalidatePath(`/projects/${projectId}`)
    return { success: true }
}

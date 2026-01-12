'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

    const { data: user } = await supabase.from('employees').select('role').eq('id', session.id).single()
    const isAdmin = user?.role === 'Administrator'

    if (project && project.employee_id === session.id && !isAdmin) {
        return { error: 'Unauthorized: You cannot add notes to your own project.' }
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient
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

    // check validation status and ownership first
    const { data: note } = await supabase.from('project_notes').select('validated_at, author_id').eq('id', noteId).single()

    if (!note) return { error: 'Note not found' }

    // Strict ownership check: Only author can edit
    const session = await getSession()
    if (!session || note.author_id !== session.id) {
        return { error: 'Unauthorized: You can only edit your own notes.' }
    }

    if (note.validated_at) {
        return { error: 'Ce journal est validé et ne peut plus être modifié.' }
    }

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

    // check validation status and ownership first
    const { data: note } = await supabase.from('project_notes').select('validated_at, author_id').eq('id', noteId).single()

    if (!note) return { error: 'Note not found' }

    // Strict ownership check: Only author can delete
    const session = await getSession()
    if (!session || note.author_id !== session.id) {
        return { error: 'Unauthorized: You can only delete your own notes.' }
    }

    if (note.validated_at) {
        return { error: 'Ce journal est validé et ne peut plus être supprimé.' }
    }

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
// تأكيد قراءة ملاحظة محددة (Journal)
// Validate specific note (Project Owner only)
// ────────────────────────────────────────────

export async function validateNote(formData: FormData) {
    const noteId = formData.get('note_id') as string
    const projectId = formData.get('project_id') as string

    const session = await getSession()
    if (!session) return { error: 'Unauthorized' }

    const supabase = createClient()
    const adminClient = createAdminClient()

    // Verify user is the project owner
    const { data: project } = await supabase
        .from('projects')
        .select('employee_id')
        .eq('id', projectId)
        .single()

    const currentUser = await supabase.from('employees').select('role').eq('id', session.id).single()
    const isOwner = project?.employee_id === session.id

    if (!isOwner) {
        return { error: 'Seul le responsable du projet peut valider ce journal.' }
    }

    const { error } = await adminClient
        .from('project_notes')
        .update({ validated_at: new Date().toISOString() })
        .eq('id', noteId)

    if (error) {
        console.error('Error validating note:', error)
        return { error: error.message }
    }

    revalidatePath(`/projects/${projectId}`)
    return { success: true }
}

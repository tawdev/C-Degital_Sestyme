'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createProject(formData: FormData) {
    const supabase = createClient()
    const adminClient = createAdminClient()

    const data = {
        project_name: formData.get('project_name') as string,
        employee_id: formData.get('employee_id') as string || null,
        domain_name: formData.get('domain_name') as string,
        language: formData.get('language') as string,
        project_size: formData.get('project_size') as string,
        comment: formData.get('comment') as string,
        start_date: new Date().toISOString().split('T')[0],
        end_date: null as string | null,
        status: 'pending',
        progress: 0
    }

    // Calculate progress if tasks are present
    const tasksData = JSON.parse(formData.get('tasks') as string || '[]')
    const validTasks = tasksData.filter((t: any) => t.title && t.title.trim() !== '')
    if (validTasks.length > 0) {
        data.progress = Math.round((validTasks.filter((t: any) => t.status === 'completed').length / validTasks.length) * 100)

        // Auto-update status and end_date based on progress
        if (data.progress === 100) {
            data.status = 'completed'
            data.end_date = new Date().toISOString().split('T')[0]
        } else if (data.progress > 0) {
            data.status = 'in_progress'
        }
    }

    const { data: project, error } = await adminClient.from('projects').insert(data).select().single()

    if (error) {
        return { error: error.message }
    }

    // Insert tasks
    try {
        if (validTasks.length > 0) {
            const tasksWithProjectId = validTasks.map((t: any) => ({
                project_id: project.id,
                title: t.title,
                status: t.status,
                assigned_to: t.assigned_to || null
            }))
            await adminClient.from('project_tasks').insert(tasksWithProjectId)
        }
    } catch (e) {
        console.error('Error inserting tasks:', e)
    }

    // Insert collaborators
    try {
        const collaborators = JSON.parse(formData.get('collaborators') as string || '[]')
        if (collaborators.length > 0) {
            const collaboratorsData = collaborators.map((empId: string) => ({
                project_id: project.id,
                employee_id: empId
            }))
            await adminClient.from('project_collaborators').insert(collaboratorsData)
        }
    } catch (e) {
        console.error('Error inserting collaborators:', e)
    }

    revalidatePath('/projects')
    revalidatePath('/dashboard')
    redirect('/projects')
}

export async function updateProject(formData: FormData) {
    const supabase = createClient()
    const adminClient = createAdminClient()
    const id = formData.get('id') as string

    const data = {
        project_name: formData.get('project_name') as string,
        employee_id: formData.get('employee_id') as string || null,
        domain_name: formData.get('domain_name') as string,
        language: formData.get('language') as string,
        project_size: formData.get('project_size') as string,
        comment: formData.get('comment') as string,
        start_date: formData.get('start_date') as string || null,
        end_date: formData.get('end_date') as string || null,
        status: formData.get('status') as string,
        progress: parseInt(formData.get('progress') as string) || 0
    }

    // Calculate progress if tasks are present
    const tasksData = JSON.parse(formData.get('tasks') as string || '[]')
    const validTasks = tasksData.filter((t: any) => t.title && t.title.trim() !== '')
    if (validTasks.length > 0) {
        data.progress = Math.round((validTasks.filter((t: any) => t.status === 'completed').length / validTasks.length) * 100)

        // Auto-update status and end_date based on progress
        if (data.progress === 100) {
            data.status = 'completed'
            data.end_date = new Date().toISOString().split('T')[0]
        } else if (data.progress > 0) {
            data.status = 'in_progress'
        }
    }

    const { error } = await adminClient.from('projects').update(data).eq('id', id)

    if (error) {
        return { error: error.message }
    }

    // Sync tasks: delete and re-insert using adminClient for robustness
    try {
        // 1. Delete old tasks
        await adminClient.from('project_tasks').delete().eq('project_id', id)

        // 2. Insert new tasks
        if (validTasks.length > 0) {
            const tasksWithProjectId = validTasks.map((t: any) => ({
                project_id: id,
                title: t.title,
                status: t.status,
                assigned_to: t.assigned_to || null
            }))
            await adminClient.from('project_tasks').insert(tasksWithProjectId)
        }
    } catch (e) {
        console.error('Error syncing tasks:', e)
    }

    // iOS-Style Collaborators Sync: Delete all and re-insert (Simplest for now)
    try {
        await adminClient.from('project_collaborators').delete().eq('project_id', id)

        const collaborators = JSON.parse(formData.get('collaborators') as string || '[]')
        if (collaborators.length > 0) {
            const collaboratorsData = collaborators.map((empId: string) => ({
                project_id: id,
                employee_id: empId
            }))
            await adminClient.from('project_collaborators').insert(collaboratorsData)
        }
    } catch (e) {
        console.error('Error syncing collaborators:', e)
    }

    revalidatePath('/projects')
    revalidatePath('/dashboard')
    redirect('/projects')
}

export async function deleteProject(formData: FormData) {
    const adminClient = createAdminClient()
    const id = formData.get('id') as string

    const { error } = await adminClient.from('projects').delete().eq('id', id)

    if (error) {
        console.error('Error deleting project:', error.message)
        return
    }

    revalidatePath('/projects')
    revalidatePath('/dashboard')
}

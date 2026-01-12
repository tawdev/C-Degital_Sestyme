'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateTaskStatus(taskId: string, projectId: string, newStatus: string) {
    const supabase = createClient()
    // Use admin client for project updates to bypass RLS if the user is just a collaborator
    const adminClient = createAdminClient()

    try {
        const { data, error } = await supabase
            .from('project_tasks')
            .update({ status: newStatus })
            .eq('id', taskId)
            .select()

        if (error) {
            console.error('Error updating task status:', error)
            return {
                success: false,
                message: `Erreur: ${error.message || 'Impossible de mettre à jour le statut.'} (Code: ${error.code})`
            }
        }

        if (!data || data.length === 0) {
            console.error('Update succeeded but no rows modified. RLS blocking?')
            return {
                success: false,
                message: "Aucune modification effectuée. Vous n'avez probablement pas la permission (RLS)."
            }
        }

        // --- Recalculate Project Progress ---
        // Fetch all tasks for this project to calculate new progress
        const { data: allTasks, error: tasksError } = await supabase
            .from('project_tasks')
            .select('status')
            .eq('project_id', projectId)

        if (!tasksError && allTasks && allTasks.length > 0) {
            const totalTasks = allTasks.length
            const completedTasks = allTasks.filter(t => t.status === 'completed' || t.status === 'done').length
            const progress = Math.round((completedTasks / totalTasks) * 100)

            let projectStatus = 'pending'
            if (progress === 100) {
                projectStatus = 'completed'
            } else if (progress > 0) {
                projectStatus = 'in_progress'
            }

            // Update project
            await adminClient
                .from('projects')
                .update({
                    progress: progress,
                    status: projectStatus,
                    end_date: progress === 100 ? new Date().toISOString().split('T')[0] : null
                })
                .eq('id', projectId)
        }
        // ------------------------------------

        revalidatePath(`/projects/${projectId}`)
        revalidatePath('/projects') // Also revalidate the list
        return { success: true }
    } catch (err) {
        console.error('Unexpected error:', err)
        return {
            success: false,
            message: 'Une erreur inattendue est survenue.'
        }
    }
}

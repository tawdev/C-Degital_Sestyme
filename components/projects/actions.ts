'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateTaskStatus(taskId: string, projectId: string, newStatus: string) {
    const supabase = createClient()

    try {
        const { error } = await supabase
            .from('project_tasks')
            .update({ status: newStatus })
            .eq('id', taskId)

        if (error) {
            console.error('Error updating task status:', error)
            return {
                success: false,
                message: 'Impossible de mettre à jour le statut. Vérifiez vos permissions.'
            }
        }

        revalidatePath(`/projects/${projectId}`)
        return { success: true }
    } catch (err) {
        console.error('Unexpected error:', err)
        return {
            success: false,
            message: 'Une erreur inattendue est survenue.'
        }
    }
}

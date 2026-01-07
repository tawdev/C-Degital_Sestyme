'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createProject(formData: FormData) {
    const supabase = createClient()

    const data = {
        project_name: formData.get('project_name') as string,
        employee_id: formData.get('employee_id') as string || null,
        domain_name: formData.get('domain_name') as string,
        comment: formData.get('comment') as string,
        start_date: formData.get('start_date') as string || null,
        end_date: formData.get('end_date') as string || null,
        status: 'pending',
        progress: 0
    }

    const { error } = await supabase.from('projects').insert(data)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/projects')
    revalidatePath('/dashboard')
    redirect('/projects')
}

export async function updateProject(formData: FormData) {
    const supabase = createClient()
    const id = formData.get('id') as string

    const data = {
        project_name: formData.get('project_name') as string,
        employee_id: formData.get('employee_id') as string || null,
        domain_name: formData.get('domain_name') as string,
        comment: formData.get('comment') as string,
        start_date: formData.get('start_date') as string || null,
        end_date: formData.get('end_date') as string || null,
        status: formData.get('status') as string,
        progress: parseInt(formData.get('progress') as string) || 0
    }

    const { error } = await supabase.from('projects').update(data).eq('id', id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/projects')
    revalidatePath('/dashboard')
    redirect('/projects')
}

export async function deleteProject(formData: FormData) {
    const supabase = createClient()
    const id = formData.get('id') as string

    const { error } = await supabase.from('projects').delete().eq('id', id)

    if (error) {
        console.error('Error deleting project:', error.message)
        return
    }

    revalidatePath('/projects')
    revalidatePath('/dashboard')
}

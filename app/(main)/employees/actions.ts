'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createEmployee(formData: FormData) {
    const supabase = createClient()

    const data = {
        full_name: formData.get('full_name') as string,
        role: formData.get('role') as string,
        email: formData.get('email') as string,
        password: formData.get('password') as string,
        phone: formData.get('phone') as string,
    }

    const { error } = await supabase.from('employees').insert(data)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/employees')
    redirect('/employees')
}

export async function updateEmployee(formData: FormData) {
    const supabase = createClient()
    const id = formData.get('id') as string
    const password = formData.get('password') as string

    const data: any = {
        full_name: formData.get('full_name') as string,
        role: formData.get('role') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
    }

    // Only update password if provided
    if (password && password.trim() !== '') {
        data.password = password
    }

    const { error } = await supabase.from('employees').update(data).eq('id', id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/employees')
    redirect('/employees')
}

export async function deleteEmployee(formData: FormData) {
    const supabase = createClient()
    const id = formData.get('id') as string

    const { error } = await supabase.from('employees').delete().eq('id', id)

    if (error) {
        console.error('Error deleting employee:', error.message)
        return
    }

    revalidatePath('/employees')
}

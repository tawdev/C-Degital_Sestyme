'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
    const id = formData.get('id') as string
    const password = formData.get('password') as string
    const email = formData.get('email') as string
    const fullName = formData.get('full_name') as string

    const data: any = {
        full_name: fullName,
        email: email,
        phone: formData.get('phone') as string,
        avatar_url: formData.get('avatar_url') as string,
        date_of_birth: formData.get('date_of_birth') as string || null,
    }

    const adminClient = createAdminClient()

    // 1. Update Password in Auth if provided
    if (password && password.trim() !== '') {
        try {
            const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
                password: password.trim()
            })

            if (authError) {
                return { error: `Auth Error: ${authError.message}` }
            }
        } catch (err: any) {
            return { error: 'System error updating password.' }
        }
    }

    // 2. Update metadata in DB using admin client to bypass RLS
    const { error: dbError } = await adminClient
        .from('employees')
        .update(data)
        .eq('id', id)

    if (dbError) {
        return { error: dbError.message }
    }

    revalidatePath('/profile')
    return { success: true }
}

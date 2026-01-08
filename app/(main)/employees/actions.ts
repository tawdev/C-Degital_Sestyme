'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createEmployee(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('full_name') as string

    // 1. Create user in Supabase Auth using Admin API
    try {
        const adminClient = createAdminClient()
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { full_name: fullName }
        })

        if (authError) {
            console.error('Auth creation error:', authError)
            return { error: `Auth Error: ${authError.message}` }
        }

        if (!authData.user) {
            return { error: 'Failed to create auth user' }
        }

        // 2. Create employee record linked to auth user using admin client to bypass RLS
        const { error: dbError } = await adminClient.from('employees').insert({
            id: authData.user.id,
            full_name: fullName,
            role: formData.get('role') as string,
            email: email,
            password: 'hashed_by_supabase_auth',
            phone: formData.get('phone') as string,
            avatar_url: formData.get('avatar_url') as string,
            date_of_birth: formData.get('date_of_birth') as string || null,
        })

        if (dbError) {
            // Cleanup auth user if DB insert fails
            await adminClient.auth.admin.deleteUser(authData.user.id)
            return { error: dbError.message }
        }

    } catch (err: any) {
        console.error('Admin client creation error:', err.message)
        return { error: 'Admin configuration error. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local' }
    }

    revalidatePath('/employees')
    redirect('/employees')
}

import { createAdminClient } from '@/lib/supabase/admin'

export async function updateEmployee(formData: FormData) {
    let id = formData.get('id') as string // Use let because we might update it
    const password = formData.get('password') as string
    const email = formData.get('email') as string
    const fullName = formData.get('full_name') as string

    const data: any = {
        full_name: fullName,
        role: formData.get('role') as string,
        email: email,
        phone: formData.get('phone') as string,
        avatar_url: formData.get('avatar_url') as string,
        date_of_birth: formData.get('date_of_birth') as string || null,
    }

    // Only update password if provided
    if (password && password.trim() !== '') {
        try {
            const adminClient = createAdminClient()
            let { error: authError } = await adminClient.auth.admin.updateUserById(id, {
                password: password.trim()
            })

            // If user doesn't exist in Auth (legacy user), try to create them
            if (authError && (authError.message.includes('User not found') || authError.status === 404)) {
                console.log('User not found in Auth by ID, checking if email exists...')

                // First, check if a user with this email already exists in Auth
                const { data: listData, error: listError } = await adminClient.auth.admin.listUsers()
                const existingAuthUser = listData?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())

                if (existingAuthUser) {
                    console.log('Found user in Auth by email, syncing IDs...')
                    // Sync the database ID to match the existing Auth ID using admin client
                    const { error: idUpdateError } = await adminClient.from('employees')
                        .update({ id: existingAuthUser.id })
                        .eq('id', id)

                    if (idUpdateError) {
                        return { error: 'Found existing Auth account but failed to sync IDs.' }
                    }

                    id = existingAuthUser.id

                    // Now update the password for the correct ID
                    const { error: secondAuthError } = await adminClient.auth.admin.updateUserById(id, {
                        password: password.trim()
                    })

                    if (secondAuthError) {
                        return { error: `Synced ID but failed to update password: ${secondAuthError.message}` }
                    }
                } else {
                    // No user found in Auth by ID or Email, create one
                    console.log('No user found in Auth by ID or Email, creating new account...')
                    const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
                        email: email,
                        password: password.trim(),
                        email_confirm: true,
                        user_metadata: { full_name: fullName }
                    })

                    if (createError) {
                        return { error: `Auth Sync Error: ${createError.message}` }
                    }

                    if (authData.user) {
                        const { error: idUpdateError } = await adminClient.from('employees')
                            .update({ id: authData.user.id })
                            .eq('id', id)

                        if (idUpdateError) {
                            return { error: 'Account created in Auth, but could not sync Database ID.' }
                        }
                        id = authData.user.id
                    }
                }
            } else if (authError) {
                console.error('Auth update error:', authError)
                return { error: `Auth Error: ${authError.message}` }
            }

            // Keep a record in the employees table for reference
            data.password = 'hashed_by_supabase_auth'
        } catch (err: any) {
            console.error('Admin client error:', err.message)
            return { error: 'System error. Check if SUPABASE_SERVICE_ROLE_KEY is set.' }
        }
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient.from('employees').update(data).eq('id', id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/employees')
    redirect('/employees')
}

export async function deleteEmployee(formData: FormData) {
    const id = formData.get('id') as string

    // 1. Delete from Supabase Auth
    try {
        const adminClient = createAdminClient()
        const { error: authError } = await adminClient.auth.admin.deleteUser(id)
        if (authError) {
            console.error('Error deleting auth user:', authError.message)
            // Continue anyway to try and delete from DB
        }
    } catch (err: any) {
        console.error('Admin client error during delete:', err.message)
    }

    // 2. Delete from DB using admin client to bypass RLS
    const adminClient = createAdminClient()
    const { error } = await adminClient.from('employees').delete().eq('id', id)

    if (error) {
        console.error('Error deleting employee:', error.message)
        return
    }

    revalidatePath('/employees')
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

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

export async function updateEmployee(formData: FormData) {
    const id = formData.get('id') as string
    const password = formData.get('password') as string
    const email = formData.get('email') as string
    const fullName = formData.get('full_name') as string
    const role = formData.get('role') as string

    console.log(`[updateEmployee] Starting update for employee ${id} (${email})`)

    try {
        const adminClient = createAdminClient()

        // 1. Fetch current record to handle email changes
        const { data: currentEmp, error: fetchError } = await adminClient
            .from('employees')
            .select('*')
            .eq('id', id)
            .single()

        if (fetchError || !currentEmp) {
            console.error('[updateEmployee] Fetch error:', fetchError)
            return { error: 'Employee not found in database.' }
        }

        // 2. Prepare Auth data
        const authUpdate: any = {
            email: email,
            user_metadata: { full_name: fullName },
            email_confirm: true
        }
        if (password && password.trim() !== '') {
            authUpdate.password = password.trim()
            console.log('[updateEmployee] Password update requested')
        }

        // 3. Try updating Auth by ID
        let targetAuthId = id
        let { error: authError } = await adminClient.auth.admin.updateUserById(id, authUpdate)

        if (authError && (authError.status === 404 || authError.message.toLowerCase().includes('not found'))) {
            console.log('[updateEmployee] ID mismatch or user shifted in Auth. Searching by current email:', currentEmp.email)

            // Search by CURRENT email (the one already in Auth)
            const { data: listData } = await adminClient.auth.admin.listUsers()
            const existingAuth = listData?.users.find((u: any) => u.email?.toLowerCase() === currentEmp.email.toLowerCase())

            if (existingAuth) {
                console.log(`[updateEmployee] Found Auth user with matching email. Actual Auth ID: ${existingAuth.id}`)
                targetAuthId = existingAuth.id

                // Update the correct Auth account
                const { error: secondAuthError } = await adminClient.auth.admin.updateUserById(targetAuthId, authUpdate)
                if (secondAuthError) {
                    console.error('[updateEmployee] Second auth update failed:', secondAuthError)
                    return { error: `Auth sync failed: ${secondAuthError.message}` }
                }

                // Try to sync IDs in DB if different
                if (targetAuthId !== id) {
                    console.log(`[updateEmployee] Attempting to sync DB ID ${id} -> ${targetAuthId}`)
                    const { error: idSyncError } = await adminClient
                        .from('employees')
                        .update({ id: targetAuthId })
                        .eq('id', id)

                    if (idSyncError) {
                        console.error('[updateEmployee] ID Sync failed (likely FK constraints):', idSyncError.message)
                        // We continue with the old ID for DB updates to avoid breaking the UI
                    } else {
                        console.log('[updateEmployee] ID Sync successful')
                        // Proceed using the new ID for the final update if needed, but the update above already changed it.
                        // However, the eq('id', id) below would fail if we don't update our 'id' variable.
                    }
                }
            } else {
                return { error: 'Associated authentication account not found. Please contact support.' }
            }
        } else if (authError) {
            console.error('[updateEmployee] Auth update error:', authError)
            return { error: `Auth Error: ${authError.message}` }
        }

        // 4. Update Database
        const dbUpdate = {
            full_name: fullName,
            role: role,
            email: email,
            password: 'hashed_by_supabase_auth'
        }

        const { error: dbError } = await adminClient
            .from('employees')
            .update(dbUpdate)
            .or(`id.eq.${id},id.eq.${targetAuthId}`) // Try both in case sync happened

        if (dbError) {
            console.error('[updateEmployee] Database update error:', dbError)
            return { error: dbError.message }
        }

        console.log('[updateEmployee] Update completed successfully')
        revalidatePath('/employees')
        return { success: true }

    } catch (err: any) {
        console.error('[updateEmployee] Unexpected error:', err)
        return { error: 'A system error occurred during the update.' }
    }
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

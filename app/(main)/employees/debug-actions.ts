'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function debugUserIdentity(email: string) {
    console.log('[DEBUG] Starting identity check for:', email)
    const adminClient = createAdminClient()

    // 1. Check database
    const { data: employee, error: empError } = await adminClient
        .from('employees')
        .select('*')
        .eq('email', email)
        .single()

    if (empError) {
        return { error: `Employee table error: ${empError.message}` }
    }

    // 2. Check Auth
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers()

    if (authError) {
        return { error: `Auth list error: ${authError.message}` }
    }

    const authByEmail = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    const authById = authUsers.users.find(u => u.id === employee.id)

    return {
        table: {
            id: employee.id,
            email: employee.email,
            full_name: employee.full_name
        },
        auth: {
            foundByEmail: authByEmail ? {
                id: authByEmail.id,
                email: authByEmail.email,
                lastSignIn: authByEmail.last_sign_in_at
            } : null,
            foundById: authById ? {
                id: authById.id,
                email: authById.email,
                lastSignIn: authById.last_sign_in_at
            } : null
        },
        mismatch: authByEmail && authById && authByEmail.id !== authById.id
    }
}

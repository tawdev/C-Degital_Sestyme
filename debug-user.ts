
import { createAdminClient } from './lib/supabase/admin'

async function debugUser(email: string) {
    const adminClient = createAdminClient()

    console.log('--- DEBUG START ---')
    console.log('Checking Employee table for:', email)
    const { data: employee, error: empError } = await adminClient
        .from('employees')
        .select('*')
        .eq('email', email)
        .single()

    if (empError) {
        console.error('Employee Table Error:', empError.message)
    } else {
        console.log('Employee found:', {
            id: employee.id,
            email: employee.email,
            full_name: employee.full_name
        })
    }

    console.log('\nChecking Supabase Auth Users...')
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers()

    if (authError) {
        console.error('Auth List Error:', authError.message)
    } else {
        const matchingAuth = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
        if (matchingAuth) {
            console.log('Auth user found:', {
                id: matchingAuth.id,
                email: matchingAuth.email,
                last_sign_in: matchingAuth.last_sign_in_at
            })

            if (employee && employee.id !== matchingAuth.id) {
                console.error('CRITICAL: ID MISMATCH between Employee table and Auth!')
            }
        } else {
            console.log('No user found in Auth with email:', email)
            const matchingId = authUsers.users.find(u => u.id === employee?.id)
            if (matchingId) {
                console.log('However, a user with ID', employee?.id, 'found in Auth with email:', matchingId.email)
            }
        }
    }
    console.log('--- DEBUG END ---')
}

const targetEmail = process.argv[2] || 'simoibaali2004@gmail.com'
debugUser(targetEmail)

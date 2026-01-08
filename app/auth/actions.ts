'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const supabase = createClient()

    // 1. Authenticate with Supabase Auth
    const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (authError) {
        return { error: authError.message }
    }

    // 2. Fetch employee details (now allowed due to RLS policy for authenticated users)
    const { data: employee, error: dbError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .single()

    let finalEmployee = employee

    if (dbError || !employee) {
        // Fallback: If auth exists but employee record is missing (orphaned auth user),
        // try to recreate the employee record using auth metadata.
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (user) {
            const fullName = user.user_metadata?.full_name || 'Unknown User'

            const { data: newEmployee, error: insertError } = await supabase
                .from('employees')
                .insert({
                    id: user.id,
                    full_name: fullName,
                    email: email,
                    password: 'hashed_by_supabase_auth',
                    role: 'Employee'
                })
                .select()
                .single()

            if (!insertError && newEmployee) {
                finalEmployee = newEmployee
            } else {
                await supabase.auth.signOut()
                return { error: 'Employee record not found and could not be created' }
            }
        } else {
            await supabase.auth.signOut()
            return { error: 'Employee record not found' }
        }
    }

    // 3. Create session cookie (Process maintained for compatibility)
    const cookieStore = cookies()
    cookieStore.set('employee_session', JSON.stringify({
        id: finalEmployee.id,
        email: finalEmployee.email,
        full_name: finalEmployee.full_name,
        role: finalEmployee.role
    }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    redirect('/dashboard')
}

export async function signup(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string

    const supabase = createClient()

    // 1. Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            }
        }
    })

    if (authError) {
        return { error: authError.message }
    }

    if (!authData.user) {
        return { error: 'Signup failed' }
    }

    // 2. Create employee record
    // Note: This relies on the table allowing inserts or being in a state where this works.
    // If RLS prevents INSERT, this step might fail. 
    // However, since we are authenticated now (signUp signs in by default usually), 
    // we need to check if there is an INSERT policy.
    // If not, this is best effort.

    const { data: employee, error: dbError } = await supabase
        .from('employees')
        .insert({
            id: authData.user.id, // Sync ID with Auth ID
            full_name: fullName,
            email: email,
            password: 'hashed_by_supabase_auth', // Placeholder as we use Supabase Auth now
            role: 'Employee'
        })
        .select()
        .single()

    if (dbError) {
        return { error: dbError.message }
    }

    // 3. Create session cookie
    const cookieStore = cookies()
    cookieStore.set('employee_session', JSON.stringify({
        id: employee.id,
        email: employee.email,
        full_name: employee.full_name,
        role: employee.role
    }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    redirect('/dashboard')
}

export async function logout() {
    const cookieStore = cookies()
    cookieStore.delete('employee_session')
    redirect('/auth/login')
}

export async function getSession() {
    const cookieStore = cookies()
    const session = cookieStore.get('employee_session')

    if (!session) {
        return null
    }

    try {
        return JSON.parse(session.value)
    } catch {
        return null
    }
}
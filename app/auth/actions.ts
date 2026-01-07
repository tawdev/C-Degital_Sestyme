'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const supabase = createClient()

    // Check credentials in employees table
    const { data: employee, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single()

    if (error || !employee) {
        return { error: 'Invalid credentials' }
    }

    // Create session cookie
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

export async function signup(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string

    const supabase = createClient()

    // Check if email already exists
    const { data: existing } = await supabase
        .from('employees')
        .select('id')
        .eq('email', email)
        .single()

    if (existing) {
        return { error: 'Email already exists' }
    }

    // Create new employee
    const { data: employee, error } = await supabase
        .from('employees')
        .insert({
            full_name: fullName,
            email: email,
            password: password,
            role: 'Employee'
        })
        .select()
        .single()

    if (error) {
        return { error: error.message }
    }

    // Create session cookie
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

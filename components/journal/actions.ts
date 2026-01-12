'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/app/auth/actions'

export async function getUnvalidatedNotesCount() {
    const session = await getSession()
    if (!session) return 0

    const supabase = createClient()
    const adminClient = createAdminClient()

    // Get user role
    const { data: user } = await supabase
        .from('employees')
        .select('role')
        .eq('id', session.id)
        .single()

    const isAdmin = user?.role === 'Administrator'

    if (isAdmin) {
        // Admins see ALL unvalidated notes
        const { count } = await adminClient
            .from('project_notes')
            .select('*', { count: 'exact', head: true })
            .is('validated_at', null)

        return count || 0
    } else {
        // Project Owners see unvalidated notes for THEIR projects only
        const { count } = await adminClient
            .from('project_notes')
            .select('*, projects!inner(employee_id)', { count: 'exact', head: true })
            .is('validated_at', null)
            .eq('projects.employee_id', session.id)

        return count || 0
    }
}

export async function getOwnedProjectIds() {
    const session = await getSession()
    if (!session) return []

    const supabase = createClient()

    // Check if admin
    const { data: user } = await supabase.from('employees').select('role').eq('id', session.id).single()
    if (user?.role === 'Administrator') return 'ADMIN' // Special flag for admin

    const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('employee_id', session.id)

    return projects?.map(p => p.id) || []
}

export async function getUnvalidatedNotes() {
    const session = await getSession()
    if (!session) return []

    const supabase = createClient()
    const adminClient = createAdminClient()

    // Get user role
    const { data: user } = await supabase
        .from('employees')
        .select('role')
        .eq('id', session.id)
        .single()

    const isAdmin = user?.role === 'Administrator'

    if (isAdmin) {
        // Admins see ALL unvalidated notes
        const { data } = await adminClient
            .from('project_notes')
            .select(`
                id,
                content,
                created_at,
                project_id,
                projects (
                    project_name
                ),
                author:employees!author_id (
                    full_name
                )
            `)
            .is('validated_at', null)
            .order('created_at', { ascending: false })
            .limit(10) // Limit to recent 10 for dropdown

        return data || []
    } else {
        // Project Owners see unvalidated notes for THEIR projects only
        const { data } = await adminClient
            .from('project_notes')
            .select(`
                id,
                content,
                created_at,
                project_id,
                projects!inner (
                    project_name,
                    employee_id
                ),
                author:employees!author_id (
                    full_name
                )
            `)
            .is('validated_at', null)
            .eq('projects.employee_id', session.id)
            .order('created_at', { ascending: false })
            .limit(10)

        return data || []
    }
}

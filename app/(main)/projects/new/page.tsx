import { createClient } from '@/lib/supabase/server'
import ProjectForm from '../project-form'
import { getSession } from '@/app/auth/actions'
import { redirect } from 'next/navigation'

export default async function NewProjectPage() {
    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const supabase = createClient()

    // Get current user role
    const { data: currentUser } = await supabase
        .from('employees')
        .select('id, role')
        .eq('id', session.id)
        .single()

    // Fetch employees for assignment
    let employees = []
    if (currentUser?.role === 'Administrator') {
        const { data } = await supabase.from('employees').select('id, full_name').order('full_name')
        employees = data || []
    } else {
        const { data: employee } = await supabase
            .from('employees')
            .select('id, full_name')
            .eq('id', session.id)
            .single()
        employees = employee ? [employee] : []
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Project</h1>
            <ProjectForm employees={employees} />
        </div>
    )
}

import { createClient } from '@/lib/supabase/server'
import ProjectForm from '../../project-form'
import { getSession } from '@/app/auth/actions'
import { redirect, notFound } from 'next/navigation'

export default async function EditProjectPage({ params }: { params: { id: string } }) {
    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const supabase = createClient()

    // Fetch the project
    const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', params.id)
        .single()

    if (!project) {
        notFound()
    }

    // Get current user role to determine if they can edit and what employees they see
    const { data: currentUser } = await supabase
        .from('employees')
        .select('id, role')
        .eq('id', session.id)
        .single()

    // Authorization: Only owner or admin can edit
    // (Note: The projects page already filters this, but just in case)
    if (currentUser?.role !== 'Administrator' && project.employee_id !== session.id) {
        redirect('/projects')
    }

    // Fetch employees for the "Assigned To" select
    let employees = []
    if (currentUser?.role === 'Administrator') {
        const { data } = await supabase.from('employees').select('id, full_name')
        employees = data || []
    } else {
        const { data } = await supabase.from('employees').select('id, full_name').eq('id', session.id)
        employees = data || []
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Project: {project.project_name}</h1>
            <ProjectForm employees={employees} project={project} />
        </div>
    )
}

import { createClient } from '@/lib/supabase/server'
import ProjectForm from '../../project-form'
import { getSession } from '@/app/auth/actions'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, PenTool } from 'lucide-react'

export default async function EditProjectPage({ params }: { params: { id: string } }) {
    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const supabase = createClient()

    // Fetch the project
    const { data: project } = await supabase
        .from('projects')
        .select('*, project_tasks(*), project_collaborators(*)')
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

    // Authorization: Only owner can edit. Admins are explicitly blocked (Read-only).
    if (currentUser?.role === 'Administrator' || project.employee_id !== session.id) {
        redirect('/projects')
    }

    // Fetch employees for assignment (Everyone can assign collaborators)
    const { data } = await supabase.from('employees').select('id, full_name, role').order('full_name')
    const employees = data || []

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Breadcrumb / Header */}
            <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Link href="/projects" className="hover:text-indigo-600 transition-colors">Projets</Link>
                    <ChevronRight className="h-4 w-4" />
                    <span>Modifier</span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm">
                        <PenTool className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Modifier le Projet</h1>
                        <p className="text-sm font-medium text-gray-500">{project.project_name}</p>
                    </div>
                </div>
            </div>

            <ProjectForm employees={employees} project={project} currentUserId={session.id} />
        </div>
    )
}

import { createClient } from '@/lib/supabase/server'
import ProjectForm from '../project-form'
import { getSession } from '@/app/auth/actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, FolderPlus } from 'lucide-react'

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

    if (currentUser?.role === 'Administrator') {
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
                    <span>Nouveau</span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm">
                        <FolderPlus className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Créer un Nouveau Projet</h1>
                        <p className="text-sm font-medium text-gray-500">Initialisez un nouveau dossier client ou interne.</p>
                    </div>
                </div>
            </div>

            <ProjectForm employees={employees} currentUserId={session.id} />
        </div>
    )
}

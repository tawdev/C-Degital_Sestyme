import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/app/auth/actions'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Globe, User, TrendingUp, CheckCircle2, MessageSquare, Clock, BarChart3, Layout, ListChecks, Circle } from 'lucide-react'
import NotesSection from './notes-section'
import TaskList from '@/components/projects/task-list'

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const supabase = createClient()
    const adminClient = createAdminClient()

    // Fetch project and notes data
    // Use adminClient for fetching project data to ensure visibility (bypass RLS)
    // Fetch tasks using standard supabase client to enforce RLS (only collaborators see tasks)
    const [projectRes, notesRes, tasksRes, adminRes] = await Promise.all([
        adminClient
            .from('projects')
            .select('*, employees!projects_employee_id_fkey(id, full_name, role)')
            .eq('id', params.id)
            .single(),
        adminClient
            .from('project_notes')
            .select('*, author:employees(full_name, role)')
            .eq('project_id', params.id)
            .order('created_at', { ascending: false }),
        supabase
            .from('project_tasks')
            .select('*, assignee:employees!assignee_id(full_name)')
            .eq('project_id', params.id)
            .order('created_at', { ascending: true }),
        supabase.from('employees').select('role').eq('id', session.id).single()
    ])

    const project = projectRes.data
    const notes = notesRes.data || []
    const tasks = tasksRes.data || []

    if (!project) {
        notFound()
    }

    const projectOwner = Array.isArray(project.employees)
        ? project.employees[0]
        : project.employees

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Navigation */}
            <div className="flex items-center justify-between">
                <Link
                    href="/projects"
                    className="group inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-all"
                >
                    <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm group-hover:shadow group-hover:border-indigo-100 transition-all">
                        <ArrowLeft className="h-4 w-4" />
                    </div>
                    <span>Retour aux Projets</span>
                </Link>

                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-indigo-100">
                        Détails du Projet
                    </span>
                </div>
            </div>

            {/* Main Project Card */}
            <div className="bg-white rounded-3xl shadow-xl shadow-indigo-900/5 border border-gray-100 overflow-hidden">
                {/* Hero Header */}
                <div className="relative bg-slate-900 px-8 py-12 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 blur-3xl opacity-50" />
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />

                    <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest">
                                <Layout className="h-4 w-4" />
                                Portfolio Project
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                                {project.project_name}
                            </h1>
                            {project.domain_name && (
                                <a
                                    href={project.domain_name.startsWith('http') ? project.domain_name : `https://${project.domain_name}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-all bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-sm group"
                                >
                                    <Globe className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                                    <span className="font-medium">{project.domain_name}</span>
                                </a>
                            )}
                        </div>

                        <div className="flex flex-col items-end gap-3">
                            <span className={`px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg ${project.status === 'completed' ? 'bg-emerald-500 text-white shadow-emerald-500/20' :
                                project.status === 'in_progress' ? 'bg-indigo-500 text-white shadow-indigo-500/20' :
                                    'bg-amber-500 text-white shadow-amber-500/20'
                                }`}>
                                {project.status === 'in_progress' ? 'En Cours' :
                                    project.status === 'completed' ? 'Terminé' : 'En Attente'}
                            </span>
                            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Dernière mise à jour: {new Date(project.updated_at || project.created_at).toLocaleDateString('fr-FR')}</p>
                        </div>
                    </div>
                </div>

                {/* Metrics Tiles */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-b border-gray-100">
                    {/* Progress */}
                    <div className="p-8 space-y-4 border-r border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center justify-between">
                            <BarChart3 className="h-5 w-5 text-indigo-500" />
                            <span className="text-2xl font-black text-gray-900">{project.progress}%</span>
                        </div>
                        <div className="space-y-2">
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden shadow-inner">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${project.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500'
                                        }`}
                                    style={{ width: `${project.progress}%` }}
                                />
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progression Globale</p>
                        </div>
                    </div>

                    {/* Assigned */}
                    <div className="p-8 space-y-4 border-r border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                            {projectOwner ? (
                                <>
                                    <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-200">
                                        {projectOwner.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate">{projectOwner.full_name}</p>
                                        <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-tight">{projectOwner.role || 'Expert'}</p>
                                    </div>
                                </>
                            ) : (
                                <span className="text-sm text-gray-400 font-bold italic">Non Assigné</span>
                            )}
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Responsable du Projet</p>
                    </div>

                    {/* Info 1 */}
                    <div className="p-8 space-y-4 border-r border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-3 text-gray-900 font-bold">
                            <MessageSquare className="h-5 w-5 text-purple-500" />
                            <span className="text-sm">{project.language || 'Standard'}</span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Langage Principal</p>
                    </div>

                    {/* Info 2 */}
                    <div className="p-8 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-3 text-gray-900 font-bold">
                            <TrendingUp className="h-5 w-5 text-amber-500" />
                            <span className="text-sm">{project.project_size || 'Moyen'}</span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Taille du Projet</p>
                    </div>
                </div>

                {/* Main Content Info */}
                <div className="p-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Description Area */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-indigo-500" />
                                Description & Objectifs
                            </h3>
                            <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
                                <p className="text-gray-700 leading-relaxed font-medium">
                                    {project.comment || "Aucune description détaillée n'a été fournie pour ce projet."}
                                </p>
                            </div>
                        </div>

                        {/* Tasks Area */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                <ListChecks className="h-4 w-4 text-indigo-500" />
                                Progression des Tâches
                            </h3>
                            <TaskList
                                tasks={tasks}
                                projectId={project.id}
                                currentUserId={session.id}
                            />
                        </div>
                    </div>

                    {/* Timeline Sidebar */}
                    <div className="space-y-8">
                        <div className="bg-indigo-50/30 rounded-3xl p-8 border border-indigo-100 flex flex-col gap-6">
                            <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Timeline</h3>

                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-white rounded-xl shadow-sm">
                                        <Clock className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Démarrage</p>
                                        <p className="text-sm font-bold text-indigo-900">
                                            {project.start_date ? new Date(project.start_date).toLocaleDateString('fr-FR', {
                                                year: 'numeric', month: 'long', day: 'numeric'
                                            }) : 'Non spécifié'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-white rounded-xl shadow-sm">
                                        <CheckCircle2 className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Échéance</p>
                                        <p className="text-sm font-bold text-indigo-900">
                                            {project.end_date ? new Date(project.end_date).toLocaleDateString('fr-FR', {
                                                year: 'numeric', month: 'long', day: 'numeric'
                                            }) : 'Non spécifiée'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <Link
                                href={`/projects/${project.id}/edit`}
                                className="mt-4 w-full text-center py-3 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                            >
                                Modifier le Projet
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notes Section Container */}
            <div className="relative">
                <NotesSection
                    projectId={project.id}
                    projectOwnerId={project.employee_id}
                    currentUserId={session.id}
                    notes={notes}
                    notesValidatedAt={project.notes_validated_at}
                    isAdmin={adminRes.data?.role === 'Administrator'}
                />
            </div>
        </div>
    )
}

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/app/auth/actions'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Globe, User, TrendingUp, CheckCircle2, MessageSquare } from 'lucide-react'
import NotesSection from './notes-section'

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
    // ────────────────────────────────────────────
    // التحقق من المصادقة
    // Authentication check
    // ────────────────────────────────────────────

    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const supabase = createClient()

    // ────────────────────────────────────────────
    // جلب بيانات المشروع والملاحظات
    // Fetch project and notes data
    // ────────────────────────────────────────────

    const [projectRes, notesRes] = await Promise.all([
        supabase
            .from('projects')
            .select('*, employees(id, full_name, role)')
            .eq('id', params.id)
            .single(),
        supabase
            .from('project_notes')
            .select('*, author:employees(full_name, role)')
            .eq('project_id', params.id)
            .order('created_at', { ascending: false })
    ])

    const project = projectRes.data
    const notes = notesRes.data || []

    if (!project) {
        notFound()
    }

    // معلومات صاحب المشروع
    // Project owner info
    const projectOwner = Array.isArray(project.employees)
        ? project.employees[0]
        : project.employees

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header with back button */}
            <div className="flex items-center gap-4">
                <Link
                    href="/projects"
                    className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                    <span>Back to Projects</span>
                </Link>
            </div>

            {/* Project Details Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-white">
                    <h1 className="text-3xl font-bold mb-2">{project.project_name}</h1>
                    {project.domain_name && (
                        <a
                            href={project.domain_name.startsWith('http') ? project.domain_name : `https://${project.domain_name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-indigo-100 hover:text-white transition-colors"
                        >
                            <Globe className="h-4 w-4" />
                            <span className="hover:underline">{project.domain_name}</span>
                        </a>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Status and Progress */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">Status</label>
                            <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                    project.status === 'in_progress' ? 'bg-emerald-100 text-emerald-800' :
                                        'bg-amber-100 text-amber-800'
                                }`}>
                                {project.status === 'in_progress' ? 'In Progress' :
                                    project.status === 'completed' ? 'Completed' : 'Pending'}
                            </span>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">Progress</label>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 bg-gray-200 rounded-full h-3">
                                    <div
                                        className={`h-3 rounded-full transition-all ${project.status === 'completed' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                                                project.status === 'in_progress' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                                                    'bg-gradient-to-r from-amber-500 to-amber-600'
                                            }`}
                                        style={{ width: `${project.progress}%` }}
                                    ></div>
                                </div>
                                <span className="text-sm font-semibold text-gray-700 min-w-[50px]">
                                    {project.progress}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Assigned To */}
                    <div>
                        <label className="text-sm font-medium text-gray-600 mb-2 block">Assigned To</label>
                        {projectOwner ? (
                            <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                                    {projectOwner.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{projectOwner.full_name}</p>
                                    <p className="text-xs text-gray-500">{projectOwner.role || 'Employee'}</p>
                                </div>
                            </div>
                        ) : (
                            <span className="text-sm text-gray-400 flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Unassigned
                            </span>
                        )}
                    </div>

                    {/* Dates */}
                    {(project.start_date || project.end_date) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {project.start_date && (
                                <div>
                                    <label className="text-sm font-medium text-gray-600 mb-2 block flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        Start Date
                                    </label>
                                    <p className="text-sm text-gray-900">
                                        {new Date(project.start_date).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            )}

                            {project.end_date && (
                                <div>
                                    <label className="text-sm font-medium text-gray-600 mb-2 block flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        End Date
                                    </label>
                                    <p className="text-sm text-gray-900">
                                        {new Date(project.end_date).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Comment */}
                    {project.comment && (
                        <div>
                            <label className="text-sm font-medium text-gray-600 mb-2 block">Description</label>
                            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-4">
                                {project.comment}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Notes Section */}
            <NotesSection
                projectId={project.id}
                projectOwnerId={project.employee_id}
                currentUserId={session.id}
                notes={notes}
                notesValidatedAt={project.notes_validated_at}
            />
        </div>
    )
}

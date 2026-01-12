import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Trash2, Edit, Plus, Globe, User, Activity, Clock, CheckCircle2, Eye } from 'lucide-react'
import { deleteProject } from './actions'
import { getSession, logout } from '@/app/auth/actions'
import { redirect } from 'next/navigation'
import EmployeeAvatar from '@/components/employee-avatar'

interface Project {
    id: string
    project_name: string
    domain_name: string | null
    language: string | null
    project_size: string | null
    status: string
    progress: number
    employee_id: string | null
    employees: { full_name: string, avatar_url: string | null } | { full_name: string, avatar_url: string | null }[] | null
}

export default async function ProjectsPage({
    searchParams,
}: {
    searchParams: { employee_id?: string }
}) {
    // ────────────────────────────────────────────
    // التحقق من المصادقة والحصول على معلومات المستخدم
    // Authentication & User Info
    // ────────────────────────────────────────────

    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const supabase = createClient()

    // جلب دور المستخدم الحالي
    // Get current user's role
    const { data: currentUser } = await supabase
        .from('employees')
        .select('id, role')
        .eq('id', session.id)
        .single()

    if (!currentUser) {
        // Redirect to a route handler to perform the logout (cookie deletion)
        redirect('/auth/signout')
    }

    const isAdmin = currentUser.role === 'Administrator'
    const currentUserId = currentUser.id

    // ────────────────────────────────────────────
    // جلب المشاريع
    // Fetch Projects
    // ────────────────────────────────────────────

    // جميع المستخدمين يرون جميع المشاريع
    // All users see all projects (Using adminClient to bypass any restrictive RLS)
    const adminClient = createAdminClient()
    let query = adminClient
        .from('projects')
        .select('*, employees!projects_employee_id_fkey(full_name, avatar_url)')

    // إذا كان هناك فلتر من searchParams (من صفحة البروفايل)
    // If there's a filter from searchParams (from profile page)
    if (searchParams.employee_id) {
        query = query.eq('employee_id', searchParams.employee_id)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) {
        console.error('Error fetching projects:', error)
    }

    const projects = (data as unknown as Project[]) || []

    const activeCount = projects.filter(p => p.status === 'in_progress').length
    const pendingCount = projects.filter(p => p.status === 'pending').length
    const completedCount = projects.filter(p => p.status === 'completed').length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
                    <p className="mt-2 text-gray-600">Manage website projects and track their progress</p>
                </div>
                {/* Allow both Employees and Admins to create projects */}
                {/* Allow only Employees (not Admins) to create projects */}
                {!isAdmin && (
                    <Link
                        href="/projects/new"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                    >
                        <Plus className="h-5 w-5" />
                        New Project
                    </Link>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <Activity className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Projects</p>
                            <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-50 p-3 rounded-lg">
                            <Activity className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">In Progress</p>
                            <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-50 p-3 rounded-lg">
                            <Clock className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Pending</p>
                            <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <CheckCircle2 className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Completed</p>
                            <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Project
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Language
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Size
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Assigned To
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Progress
                                </th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {projects.map((project) => {
                                const assignee = Array.isArray(project.employees)
                                    ? project.employees[0]?.full_name
                                    : project.employees?.full_name

                                return (
                                    <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{project.project_name}</div>
                                                {project.domain_name && (
                                                    <a
                                                        href={project.domain_name.startsWith('http') ? project.domain_name : `https://${project.domain_name}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-1 group"
                                                    >
                                                        <Globe className="h-3 w-3" />
                                                        <span className="group-hover:underline">{project.domain_name}</span>
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-600 font-medium">{project.language || '-'}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {project.project_size ? (
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.project_size.toLowerCase().includes('large') ? 'bg-purple-100 text-purple-800' :
                                                    project.project_size.toLowerCase().includes('medium') ? 'bg-indigo-100 text-indigo-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {project.project_size}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {project.employees ? (
                                                <div className="flex items-center gap-3">
                                                    <EmployeeAvatar
                                                        avatarUrl={Array.isArray(project.employees) ? project.employees[0]?.avatar_url : project.employees?.avatar_url}
                                                        fullName={Array.isArray(project.employees) ? project.employees[0]?.full_name : project.employees?.full_name}
                                                        className="h-8 w-8 text-[10px]"
                                                    />
                                                    <span className="text-sm font-semibold text-gray-900">
                                                        {Array.isArray(project.employees) ? project.employees[0]?.full_name : project.employees?.full_name}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400 flex items-center gap-2">
                                                    <User className="h-4 w-4" />
                                                    Non Assigné
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                                project.status === 'in_progress' ? 'bg-emerald-100 text-emerald-800' :
                                                    'bg-amber-100 text-amber-800'
                                                }`}>
                                                {project.status === 'in_progress' ? 'In Progress' :
                                                    project.status === 'completed' ? 'Completed' : 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[120px]">
                                                    <div
                                                        className={`h-2 rounded-full transition-all duration-500 ${project.status === 'completed' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                                                            project.status === 'in_progress' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                                                                'bg-gradient-to-r from-amber-500 to-amber-600'
                                                            }`}
                                                        style={{ width: `${project.progress}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-sm font-medium text-gray-700 min-w-[40px]">{project.progress}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                {/* ────────────────────────────────────────────
                                                    منطق الصلاحيات:
                                                    - View: متاح للجميع
                                                    - Edit/Delete: EMPLOYEE فقط لمشاريعه
                                                    
                                                    Authorization Logic:
                                                    - View: Available to everyone
                                                    - Edit/Delete: EMPLOYEE only for own projects
                                                ──────────────────────────────────────────── */}

                                                {/* زر View - متاح للجميع */}
                                                {/* View button - available to everyone */}
                                                <Link
                                                    href={`/projects/${project.id}`}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="h-4 w-4" />

                                                </Link>

                                                {/* Edit/Delete buttons -  Disabled for Admin (Read-only), Employee only for own projects */}
                                                {!isAdmin && project.employee_id === currentUserId && (
                                                    <>
                                                        <Link
                                                            href={`/projects/${project.id}/edit`}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="Edit Project"
                                                        >
                                                            <Edit className="h-4 w-4" />

                                                        </Link>
                                                        <form action={deleteProject}>
                                                            <input type="hidden" name="id" value={project.id} />
                                                            <button
                                                                type="submit"
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete Project"
                                                            >
                                                                <Trash2 className="h-4 w-4" />

                                                            </button>
                                                        </form>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {projects.length === 0 && (
                        <div className="text-center py-12">
                            <Activity className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 text-sm">No projects found. {!isAdmin && "Create your first project to get started."}</p>
                            {!isAdmin && (
                                <Link
                                    href="/projects/new"
                                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                                >
                                    <Plus className="h-4 w-4" />
                                    New Project
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

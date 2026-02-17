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
        <div className="max-w-7xl mx-auto space-y-10 pb-12 transition-colors duration-500">
            {/* Header */}
            <div className="relative overflow-hidden bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 p-8 md:p-10 shadow-2xl shadow-indigo-900/5">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div>
                        <h1 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
                            Projets
                        </h1>
                        <p className="mt-3 text-lg text-gray-600 dark:text-indigo-200/60 font-medium max-w-2xl">
                            Gérez les projets de sites web et suivez leur progression avec une clarté totale.
                        </p>
                    </div>
                    {/* Allow both Employees and Admins to create projects */}
                    {!isAdmin && (
                        <Link
                            href="/projects/new"
                            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/20 hover:scale-[1.02] active:scale-[0.98] w-full md:w-auto justify-center"
                        >
                            <Plus className="h-5 w-5" />
                            Nouveau projet
                        </Link>
                    )}
                </div>
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 dark:bg-purple-600/20 blur-[100px] rounded-full animate-pulse"></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total des projets', value: projects.length, icon: Activity, color: 'text-blue-600', bgColor: 'bg-blue-50' },
                    { label: 'En cours', value: activeCount, icon: Activity, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
                    { label: 'En attente', value: pendingCount, icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50' },
                    { label: 'Terminé', value: completedCount, icon: CheckCircle2, color: 'text-indigo-600', bgColor: 'bg-indigo-50' }
                ].map((stat, idx) => (
                    <div
                        key={idx}
                        className="group relative bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] border border-gray-200 dark:border-white/10 p-6 hover:bg-white/90 dark:hover:bg-white/10 transition-all duration-300 shadow-sm"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`${stat.bgColor} dark:bg-white/5 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-500`}>
                                <stat.icon className={`h-6 w-6 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{stat.label}</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">{stat.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table Area */}
            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100 dark:divide-white/5">
                        <thead className="bg-gray-50/50 dark:bg-white/5">
                            <tr>
                                <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                    Projet
                                </th>
                                <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                    Langue
                                </th>
                                <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                    Taille
                                </th>
                                <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                    Assigné à
                                </th>
                                <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                    Statut
                                </th>
                                <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                    Progression
                                </th>
                                <th scope="col" className="px-6 py-5 text-right text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-transparent divide-y divide-gray-50 dark:divide-white/5">
                            {projects.map((project) => {
                                const assignee = Array.isArray(project.employees)
                                    ? project.employees[0]?.full_name
                                    : project.employees?.full_name

                                return (
                                    <tr key={project.id} className="hover:bg-indigo-50/30 dark:hover:bg-white/5 transition-all group">
                                        <td className="px-6 py-5">
                                            <div>
                                                <div className="text-sm font-black text-gray-900 dark:text-white transition-colors">{project.project_name}</div>
                                                {project.domain_name && (
                                                    <a
                                                        href={project.domain_name.startsWith('http') ? project.domain_name : `https://${project.domain_name}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 mt-1 group w-fit"
                                                    >
                                                        <Globe className="h-3 w-3" />
                                                        <span className="group-hover:underline font-bold uppercase tracking-widest">{project.domain_name}</span>
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className="text-xs text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest">{project.language || '-'}</span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            {project.project_size ? (
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${project.project_size.toLowerCase().includes('large') ? 'bg-purple-50 dark:bg-purple-400/10 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-400/20' :
                                                    project.project_size.toLowerCase().includes('medium') ? 'bg-blue-50 dark:bg-blue-400/10 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-400/20' :
                                                        'bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-400 border-gray-100 dark:border-white/10'
                                                    }`}>
                                                    {project.project_size}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            {project.employees ? (
                                                <div className="flex items-center gap-3">
                                                    <EmployeeAvatar
                                                        avatarUrl={Array.isArray(project.employees) ? project.employees[0]?.avatar_url : project.employees?.avatar_url}
                                                        fullName={Array.isArray(project.employees) ? project.employees[0]?.full_name : project.employees?.full_name}
                                                        className="h-8 w-8 text-[10px] font-black border border-white dark:border-white/10 shadow-sm"
                                                    />
                                                    <span className="text-xs font-black text-gray-900 dark:text-white transition-colors">
                                                        {Array.isArray(project.employees) ? project.employees[0]?.full_name : project.employees?.full_name}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400 flex items-center gap-2 font-bold uppercase tracking-widest">
                                                    <User className="h-4 w-4" />
                                                    Libre
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${project.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-400/20' :
                                                project.status === 'in_progress' ? 'bg-blue-50 dark:bg-blue-400/10 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-400/20' :
                                                    'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-400/20'
                                                }`}>
                                                {project.status === 'in_progress' ? 'En cours' :
                                                    project.status === 'completed' ? 'Terminé' : 'En attente'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 bg-gray-100 dark:bg-white/5 rounded-full h-2 min-w-[100px] overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 shadow-sm ${project.status === 'completed' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/20' :
                                                            project.status === 'in_progress' ? 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-blue-500/20' :
                                                                'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/20'
                                                            }`}
                                                        style={{ width: `${project.progress}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] font-black text-gray-900 dark:text-white transition-colors">{project.progress}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
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
                                                    className="p-2.5 bg-white dark:bg-white/5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-400/10 border border-gray-100 dark:border-white/10 rounded-xl transition-all shadow-sm"
                                                    title="Voir les détails"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Link>

                                                {/* Edit/Delete buttons -  Disabled for Admin (Read-only), Employee only for own projects */}
                                                {!isAdmin && project.employee_id === currentUserId && (
                                                    <>
                                                        <Link
                                                            href={`/projects/${project.id}/edit`}
                                                            className="p-2.5 bg-white dark:bg-white/5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-400/10 border border-gray-100 dark:border-white/10 rounded-xl transition-all shadow-sm"
                                                            title="Modifier le projet"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                        <form action={deleteProject}>
                                                            <input type="hidden" name="id" value={project.id} />
                                                            <button
                                                                type="submit"
                                                                className="p-2.5 bg-white dark:bg-white/5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 border border-gray-100 dark:border-white/10 rounded-xl transition-all shadow-sm"
                                                                title="Supprimer le projet"
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
                            <p className="text-gray-500 text-sm">Aucun projet trouvé. {!isAdmin && "Créez votre premier projet pour commencer."}</p>
                            {!isAdmin && (
                                <Link
                                    href="/projects/new"
                                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                                >
                                    <Plus className="h-4 w-4" />
                                    Nouveau projet
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

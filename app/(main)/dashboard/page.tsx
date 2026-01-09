import { createClient } from '@/lib/supabase/server'
import { Users, Briefcase, Clock, CheckCircle2, TrendingUp, Activity, ArrowUpRight, Plus } from 'lucide-react'
import Link from 'next/link'
import { getSession } from '@/app/auth/actions'
import { redirect } from 'next/navigation'
import EmployeeAvatar from '@/components/employee-avatar'

export default async function DashboardPage() {
    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const supabase = createClient()

    const { data: employee } = await supabase
        .from('employees')
        .select('role')
        .eq('id', session.id)
        .single()

    if (employee?.role !== 'Administrator') {
        redirect('/projects')
    }

    const [
        { count: projectCount },
        { count: employeeCount },
        { data: activeProjects },
        { data: pendingProjects },
        { data: completedProjectsCountData },
        { data: recentProjects }
    ] = await Promise.all([
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('id').eq('status', 'in_progress'),
        supabase.from('projects').select('id').eq('status', 'pending'),
        supabase.from('projects').select('id').eq('status', 'completed'),
        supabase.from('projects').select('id, project_name, status, progress, created_at, employees(full_name, avatar_url)').order('created_at', { ascending: false }).limit(6)
    ])

    const stats = [
        {
            name: 'Total Employees',
            value: employeeCount || 0,
            icon: Users,
            color: 'from-blue-500 to-indigo-600',
            bgColor: 'bg-blue-50',
            iconColor: 'text-blue-600',
            link: '/employees',
            description: 'Team members'
        },
        {
            name: 'Total Projects',
            value: projectCount || 0,
            icon: Briefcase,
            color: 'from-purple-500 to-pink-600',
            bgColor: 'bg-purple-50',
            iconColor: 'text-purple-600',
            link: '/projects',
            description: 'All time'
        },
        {
            name: 'Active Projects',
            value: activeProjects?.length || 0,
            icon: Activity,
            color: 'from-emerald-500 to-teal-600',
            bgColor: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            link: '/projects',
            description: 'Currently running'
        },
        {
            name: 'Completed',
            value: completedProjectsCountData?.length || 0,
            icon: CheckCircle2,
            color: 'from-orange-500 to-red-600',
            bgColor: 'bg-orange-50',
            iconColor: 'text-orange-600',
            link: '/projects',
            description: 'Successfully delivered'
        }
    ]

    return (
        <div className="max-w-[1600px] mx-auto space-y-10 pb-12">
            {/* Header with Welcome Message */}
            <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Dashboard Overview</h1>
                        <p className="mt-2 text-lg text-gray-500 font-medium">Welcome back! Here's a snapshot of your current operations.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/projects/new"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 border border-transparent rounded-xl text-base font-semibold text-white hover:bg-gray-800 transition-all duration-200 shadow-lg shadow-gray-200"
                        >
                            <Plus className="h-5 w-5" />
                            Launch Project
                        </Link>
                    </div>
                </div>
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 -u mt-[-10%] mr-[-5%] w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => {
                    const Icon = stat.icon
                    return (
                        <Link
                            key={stat.name}
                            href={stat.link}
                            className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-xl hover:border-transparent transition-all duration-300"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{stat.name}</p>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <p className="text-4xl font-black text-gray-900">{stat.value}</p>
                                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+12%</span>
                                    </div>
                                    <p className="mt-1 text-sm text-gray-500">{stat.description}</p>
                                </div>
                                <div className={`${stat.bgColor} p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                                    <Icon className={`h-7 w-7 ${stat.iconColor}`} />
                                </div>
                            </div>
                            <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r ${stat.color} rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <ArrowUpRight className="h-4 w-4 text-gray-300" />
                            </div>
                        </Link>
                    )
                })}
            </div>

            {/* Main Content Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-gray-900">
                {/* Project Analytics (2/3 width) */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Status Distribution */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Project Performance</h2>
                                <p className="text-sm text-gray-500 mt-1">Real-time status breakdown</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg">
                                <TrendingUp className="h-4 w-4" />
                                LIVE UPDATES
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* In Progress */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full border-4 border-emerald-100 bg-emerald-500"></div>
                                        <span className="text-base font-bold text-gray-700">In Progress</span>
                                    </div>
                                    <span className="text-lg font-black text-gray-900">{activeProjects?.length || 0}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                        style={{ width: `${projectCount ? (activeProjects?.length || 0) / projectCount * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Pending */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full border-4 border-amber-100 bg-amber-500"></div>
                                        <span className="text-base font-bold text-gray-700">Pending & Planning</span>
                                    </div>
                                    <span className="text-lg font-black text-gray-900">{pendingProjects?.length || 0}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-amber-400 to-amber-600 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                                        style={{ width: `${projectCount ? (pendingProjects?.length || 0) / projectCount * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Completed */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full border-4 border-indigo-100 bg-indigo-500"></div>
                                        <span className="text-base font-bold text-gray-700">Completed Assets</span>
                                    </div>
                                    <span className="text-lg font-black text-gray-900">{completedProjectsCountData?.length || 0}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                                        style={{ width: `${projectCount ? (completedProjectsCountData?.length || 0) / projectCount * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Shortcuts */}
                    <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-3xl shadow-xl p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/20 transition-all duration-500"></div>
                        <div className="relative z-10">
                            <h2 className="text-2xl font-black text-white mb-2">Management Toolkit</h2>
                            <p className="text-indigo-100 mb-8 font-medium">Perform high-priority actions across your workspace.</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Link href="/employees/new" className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-2xl p-5 transition-all duration-300 hover:scale-[1.03]">
                                    <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                                        <Users className="h-5 w-5 text-white" />
                                    </div>
                                    <h3 className="font-bold text-white text-lg">Onboard Talent</h3>
                                    <p className="text-xs text-indigo-100/70 mt-1">Create new employee profiles</p>
                                </Link>
                                <Link href="/projects/new" className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-2xl p-5 transition-all duration-300 hover:scale-[1.03]">
                                    <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                                        <Briefcase className="h-5 w-5 text-white" />
                                    </div>
                                    <h3 className="font-bold text-white text-lg">New Pipeline</h3>
                                    <p className="text-xs text-indigo-100/70 mt-1">Initialize project structure</p>
                                </Link>
                                <Link href="/projects" className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-2xl p-5 transition-all duration-300 hover:scale-[1.03]">
                                    <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                                        <CheckCircle2 className="h-5 w-5 text-white" />
                                    </div>
                                    <h3 className="font-bold text-white text-lg">Global Audit</h3>
                                    <p className="text-xs text-indigo-100/70 mt-1">Review all active operations</p>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Column (1/3 width) - Activity Feed */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
                    <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Recent Projects</h2>
                            <p className="text-sm text-gray-500">Latest workspace updates</p>
                        </div>
                        <Link href="/projects" className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors group">
                            <span className="sr-only">View all</span>
                            <Briefcase className="h-5 w-5 group-hover:scale-110 transition-transform" />
                        </Link>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto space-y-2">
                        {recentProjects && recentProjects.length > 0 ? (
                            recentProjects.map((project: any) => {
                                const employeeData = Array.isArray(project.employees) ? project.employees[0] : project.employees;
                                return (
                                    <div key={project.id} className="p-4 rounded-xl border border-transparent hover:border-gray-100 hover:bg-gray-50/50 transition-all duration-200">
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1">
                                                <EmployeeAvatar
                                                    avatarUrl={employeeData?.avatar_url}
                                                    fullName={employeeData?.full_name}
                                                    className="h-10 w-10 text-xs shadow-sm"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-gray-900 truncate">
                                                    {project.project_name}
                                                </h4>
                                                <p className="text-xs text-gray-500 font-medium mt-0.5">
                                                    Assigned to {employeeData?.full_name || 'System'}
                                                </p>
                                                <div className="flex items-center gap-2 mt-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${project.status === 'completed' ? 'bg-indigo-100 text-indigo-700' :
                                                        project.status === 'in_progress' ? 'bg-emerald-100 text-emerald-700' :
                                                            'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {project.status === 'in_progress' ? 'Running' :
                                                            project.status === 'completed' ? 'Solid' : 'Paused'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-gray-400">
                                                        {Math.round(project.progress)}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Activity className="h-8 w-8 text-gray-200 mb-2" />
                                <p className="text-sm text-gray-400 font-medium whitespace-normal px-8">No recent activity found in your workspace.</p>
                            </div>
                        )}
                    </div>
                    <div className="p-6 mt-auto">
                        <Link
                            href="/projects"
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors"
                        >
                            View All Projects
                            <ArrowUpRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
